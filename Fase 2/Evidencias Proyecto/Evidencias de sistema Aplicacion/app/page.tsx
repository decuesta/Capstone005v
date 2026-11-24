"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
// CAMBIO: este módulo atrapa el aviso de recuperación al crearse el cliente.
import { hayRecuperacionPendiente, limpiarRecuperacion } from "@/utils/enlaceRecuperacion";
import { supabase } from "@/utils/supabase";
import ConsentScreen from "./components/ConsentScreen";
import Wizard from "./components/Wizard";
import CanvasReport from "./components/CanvasReport";
import AuthScreen from "./components/AuthScreen";
import MisDiagnosticos from "./components/MisDiagnosticos";
import PlanPasoAPaso from "./components/PlanPasoAPaso";
import PantallaEspera from "./components/PantallaEspera";
import NuevaClave from "./components/NuevaClave";
import { generarDiagnostico, type ResultadoDiagnostico } from "@/app/actions/generateCanvas";
import { obtenerSesionAnonima } from "@/utils/session";
import type { RespuestasWizard } from "@/utils/scoringEngine";

// Pasos: -1 Verificando sesión, 0 Inicio (visitante), 1 Consentimiento,
// 2 Wizard, 3 Procesando, 4 Resultado (o error), 5 Autenticación,
// 6 Confirmación, 7 Ya autenticado (bienvenida), 8 Mis diagnósticos,
// 9 Plan paso a paso, 10 Nueva contraseña (tras el enlace de recuperación)
export default function Home() {
  const [currentStep, setCurrentStep] = useState<number>(-1);
  const [resultado, setResultado] = useState<ResultadoDiagnostico | null>(null);
  const [sesionAnonimaId, setSesionAnonimaId] = useState<string>("");
  const [usuario, setUsuario] = useState<User | null>(null);
  const [consentimientoAceptado, setConsentimientoAceptado] = useState<boolean>(false);
  const [esAdmin, setEsAdmin] = useState<boolean>(false);
  // Verdadero cuando la persona pidió iniciar sesión desde el plan paso a
  // paso (para contactar a una agencia): al terminar, vuelve al plan.
  const [retornoPlan, setRetornoPlan] = useState<boolean>(false);
  // Verdadero cuando la persona pidió crear una cuenta para descargar el
  // PDF: al terminar, vuelve al resultado.
  const [retornoResultado, setRetornoResultado] = useState<boolean>(false);

  // Al cargar: genera/recupera la sesión anónima y revisa si ya existe
  // una sesión de Supabase Auth activa. Si existe, va directo a la
  // pantalla de bienvenida en vez de mostrar "Iniciar Estudio". Si la
  // persona llegó por el enlace del correo de recuperación (CAMBIO: lo
  // dice la marca que deja utils/enlaceRecuperacion.ts), va a elegir su
  // contraseña nueva.
  useEffect(() => {
    setSesionAnonimaId(obtenerSesionAnonima());

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUsuario(session.user);
        setCurrentStep(hayRecuperacionPendiente() ? 10 : 7);
      } else {
        limpiarRecuperacion();
        setCurrentStep(0);
      }
    });

    // Mantiene el estado sincronizado si el usuario inicia o cierra
    // sesión en otra pestaña, o si la sesión expira.
    const { data: listener } = supabase.auth.onAuthStateChange((evento, session) => {
      setUsuario(session?.user ?? null);
      if (evento === "PASSWORD_RECOVERY") setCurrentStep(10);
      if (evento === "SIGNED_OUT") limpiarRecuperacion();
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  // Comprueba si la cuenta con sesión es administradora, para mostrar
  // el enlace al panel. Es solo una comodidad: la protección real de
  // /admin la hacen la propia pantalla y las políticas de la base.
  const usuarioId = usuario?.id ?? null;
  useEffect(() => {
    if (!usuarioId) {
      setEsAdmin(false);
      return;
    }
    let montado = true;
    supabase.rpc("es_administrador").then(({ data, error }) => {
      if (!montado) return;
      if (error) {
        console.error("No se pudo verificar el rol de administrador:", error.message);
        setEsAdmin(false);
        return;
      }
      setEsAdmin(data === true);
    });
    return () => {
      montado = false;
    };
  }, [usuarioId]);

  // Si la sesión termina (en esta pestaña, en otra o por expiración) estando
  // en una pantalla que exige sesión (la bienvenida, "Mis diagnósticos" y la
  // de nueva contraseña), vuelve al inicio. Esas vistas solo se dibujan con
  // un usuario; sin esto la página quedaba en blanco.
  useEffect(() => {
    if (!usuario && (currentStep === 7 || currentStep === 8 || currentStep === 10)) {
      setCurrentStep(0);
    }
  }, [usuario, currentStep]);

  const handleConsentimiento = () => {
    setConsentimientoAceptado(true);
    setCurrentStep(2);
  };

  const handleWizardComplete = async (data: RespuestasWizard) => {
    setCurrentStep(3);
    setResultado(null);
    try {
      const diagnostico = await generarDiagnostico(data, consentimientoAceptado, sesionAnonimaId);
      setResultado(diagnostico);

      // Si ya hay sesión iniciada, el diagnóstico recién guardado (que
      // el servidor deja sin dueño, solo con su sesion_anonima_id) se
      // asocia a la cuenta con la función reclamar_diagnosticos, que
      // toma el usuario de la sesión real, no de un dato del navegador.
      if (usuario) {
        const { error: errorReclamo } = await supabase.rpc("reclamar_diagnosticos", {
          p_sesion_anonima_id: sesionAnonimaId,
        });
        if (errorReclamo) {
          console.error("No se pudo asociar el diagnóstico a la cuenta:", errorReclamo.message);
        }
      }
    } catch (error) {
      console.error("Error al generar el diagnóstico:", error);
    } finally {
      setCurrentStep(4);
    }
  };

  const handleIrAGuardar = () => {
    setCurrentStep(5);
  };

  // Después de iniciar sesión o crear la cuenta: si venía del plan paso a
  // paso o del botón del PDF, vuelve ahí; si no, va a la confirmación.
  const handleAutenticado = () => {
    if (retornoPlan) {
      setRetornoPlan(false);
      setCurrentStep(9);
    } else if (retornoResultado) {
      setRetornoResultado(false);
      setCurrentStep(4);
    } else {
      setCurrentStep(6);
    }
  };

  // "Omitir por ahora" en la pantalla de autenticación.
  const handleOmitirAutenticacion = () => {
    if (retornoPlan) {
      setRetornoPlan(false);
      setCurrentStep(9);
    } else if (retornoResultado) {
      setRetornoResultado(false);
      setCurrentStep(4);
    } else {
      handleReiniciar();
    }
  };

  const handleIniciarSesionDesdePlan = () => {
    setRetornoPlan(true);
    setCurrentStep(5);
  };

  // Desde "Crea tu cuenta para descargar tu PDF": al terminar vuelve al resultado.
  const handleCrearCuentaParaPDF = () => {
    setRetornoResultado(true);
    setCurrentStep(5);
  };

  const handleNuevoDiagnostico = () => {
    setResultado(null);
    setRetornoPlan(false);
    setRetornoResultado(false);
    setCurrentStep(1);
  };

  const handleReiniciar = () => {
    setResultado(null);
    setRetornoPlan(false);
    setRetornoResultado(false);
    setCurrentStep(usuario ? 7 : 0);
  };

  const handleCerrarSesion = async () => {
    await supabase.auth.signOut();
    limpiarRecuperacion();
    setUsuario(null);
    setResultado(null);
    setRetornoPlan(false);
    setRetornoResultado(false);
    setCurrentStep(0);
  };

  // VISTA -1: mientras se verifica si hay sesión activa no se muestra
  // nada, para evitar el parpadeo de "Iniciar Estudio".
  if (currentStep === -1) {
    return <main className="min-h-screen bg-slate-50" />;
  }

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-slate-800">
      {/* VISTA 0: Inicio (visitante sin sesión) */}
      {currentStep === 0 && (
        <div className="max-w-xl text-center space-y-6">
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">
            E-Match
          </h1>
          <p className="text-lg text-slate-600 leading-relaxed">
            Diagnóstico inteligente para microemprendedores. Genera tu Modelo Canvas y sugerencias logísticas personalizadas en minutos.
          </p>
          <div className="flex flex-col items-center gap-3">
            <button
              onClick={() => setCurrentStep(1)}
              className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 text-lg"
            >
              Iniciar Estudio
            </button>
            <button
              onClick={() => setCurrentStep(5)}
              className="text-sm font-semibold text-slate-500 hover:text-slate-700"
            >
              ¿Ya tienes cuenta? Iniciar sesión
            </button>
          </div>
        </div>
      )}

      {/* VISTA 1: Consentimiento (RF-22) */}
      {currentStep === 1 && (
        <ConsentScreen
          onAceptar={handleConsentimiento}
          onCancel={() => setCurrentStep(usuario ? 7 : 0)}
        />
      )}

      {/* VISTA 2: Wizard */}
      {currentStep === 2 && (
        <Wizard
          onComplete={handleWizardComplete}
          onCancel={() => setCurrentStep(usuario ? 7 : 0)}
        />
      )}

      {/* VISTA 3: Pantalla de espera, con consejos para emprendedores */}
      {currentStep === 3 && <PantallaEspera />}

      {/* VISTA 4: Reporte de resultado. El botón principal lleva al plan
          paso a paso. Sin sesión: el PDF pide crear una cuenta y se ofrece
          guardar el resultado. Con sesión: el diagnóstico ya quedó asociado
          a la cuenta, y se ofrece volver a la cuenta. */}
      {currentStep === 4 && resultado && (
        <div className="max-w-2xl w-full space-y-6">
          <CanvasReport
            resultado={resultado}
            onPlanPasoAPaso={() => setCurrentStep(9)}
            puedeDescargar={!!usuario}
            onCrearCuenta={handleCrearCuentaParaPDF}
          />
          {!usuario ? (
            <button
              onClick={handleIrAGuardar}
              className="w-full p-4 border border-blue-600 text-blue-700 hover:bg-blue-50 font-semibold rounded-xl transition-all"
            >
              💾 Guardar mi resultado (crear cuenta o iniciar sesión)
            </button>
          ) : (
            <button
              onClick={() => setCurrentStep(7)}
              className="w-full p-4 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-xl transition-all"
            >
              Volver a mi cuenta
            </button>
          )}
        </div>
      )}

      {/* VISTA 4 (error): no se pudo generar el diagnóstico. */}
      {currentStep === 4 && !resultado && (
        <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center space-y-4">
          <h2 className="text-2xl font-bold text-slate-900">No pudimos generar tu diagnóstico</h2>
          <p className="text-sm text-slate-500">
            Ocurrió un problema al calcular tu resultado. Intenta de nuevo en unos minutos.
          </p>
          <button
            onClick={handleReiniciar}
            className="px-6 py-3 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-xl transition-all"
          >
            Volver al inicio
          </button>
        </div>
      )}

      {/* VISTA 5: Autenticación (RF-21). Si se llega desde "Iniciar
          sesión" en la Vista 0 (sin diagnóstico previo), abre directo en
          login y sin "Omitir", porque no hay ningún resultado que perder.
          Si se llega desde el plan paso a paso o desde el botón del PDF, al
          terminar vuelve ahí. */}
      {currentStep === 5 && (
        <AuthScreen
          sesionAnonimaId={sesionAnonimaId}
          onAutenticado={handleAutenticado}
          onOmitir={handleOmitirAutenticacion}
          modoInicial={resultado ? "registro" : "login"}
          mostrarOmitir={!!resultado}
        />
      )}

      {/* VISTA 6: Confirmación después de autenticarse. El mensaje cambia
          según si hay un diagnóstico recién hecho (asociado a la cuenta)
          o si solo se inició sesión desde la pantalla principal. El
          enlace al panel solo aparece si la cuenta es administradora. */}
      {currentStep === 6 && (
        <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center space-y-4">
          <h2 className="text-2xl font-bold text-slate-900">¡Listo!</h2>
          <p className="text-sm text-slate-500">
            {resultado
              ? "Tu resultado quedó guardado en tu cuenta."
              : "Tu cuenta quedó lista. Ya puedes hacer tu diagnóstico."}
          </p>
          <div className="flex flex-col gap-3 items-center">
            <button
              onClick={handleNuevoDiagnostico}
              className="px-6 py-3 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-xl transition-all"
            >
              Hacer un nuevo diagnóstico
            </button>
            <button
              onClick={() => setCurrentStep(8)}
              className="text-sm font-semibold text-slate-500 hover:text-slate-700"
            >
              Ver mis diagnósticos
            </button>
            {esAdmin && (
              <Link
                href="/admin"
                className="text-xs font-semibold text-slate-500 hover:text-slate-700 underline"
              >
                Panel de administración
              </Link>
            )}
          </div>
        </div>
      )}

      {/* VISTA 7: Bienvenida de vuelta (ya tiene sesión activa). El
          enlace al panel solo aparece si la cuenta es administradora. */}
      {currentStep === 7 && usuario && (
        <div className="max-w-xl text-center space-y-6">
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            Hola de nuevo 👋
          </h1>
          <p className="text-lg text-slate-600 leading-relaxed">
            Sesión iniciada como <strong>{usuario.email}</strong>.
          </p>
          <div className="flex flex-col gap-3 items-center">
            <button
              onClick={handleNuevoDiagnostico}
              className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 text-lg"
            >
              Hacer un nuevo diagnóstico
            </button>
            <button
              onClick={() => setCurrentStep(8)}
              className="px-6 py-3 bg-white hover:bg-slate-100 text-slate-700 font-semibold rounded-xl border border-slate-200 transition-all"
            >
              Mis diagnósticos
            </button>
            {esAdmin && (
              <Link
                href="/admin"
                className="text-xs font-semibold text-slate-500 hover:text-slate-700 underline"
              >
                Panel de administración
              </Link>
            )}
            <button
              onClick={handleCerrarSesion}
              className="text-sm text-slate-400 hover:text-slate-600"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      )}

      {/* VISTA 8: Mis diagnósticos (solo con sesión) */}
      {currentStep === 8 && usuario && (
        <MisDiagnosticos
          usuarioId={usuario.id}
          onVolver={() => setCurrentStep(7)}
        />
      )}

      {/* VISTA 9: Plan paso a paso. Plataformas, transportistas y agencias.
          Contactar a una agencia exige sesión: sin ella, el botón lleva a
          la autenticación y al terminar se vuelve a esta pantalla. */}
      {currentStep === 9 && resultado && (
        <div className="max-w-2xl w-full">
          <PlanPasoAPaso
            resultado={resultado}
            diagnosticoId={resultado.diagnosticoId}
            usuarioId={usuario?.id ?? null}
            onVolver={() => setCurrentStep(4)}
            onIniciarSesion={handleIniciarSesionDesdePlan}
          />
        </div>
      )}

      {/* VISTA 10: elegir una contraseña nueva, tras abrir el enlace del
          correo de recuperación. El enlace inicia una sesión temporal.
          CAMBIO: al terminar o cancelar se limpia la marca de recuperación. */}
      {currentStep === 10 && usuario && (
        <NuevaClave
          email={usuario.email ?? ""}
          onTerminar={() => {
            limpiarRecuperacion();
            setCurrentStep(7);
          }}
          onCancelar={() => {
            limpiarRecuperacion();
            setCurrentStep(7);
          }}
        />
      )}
    </main>
  );
}