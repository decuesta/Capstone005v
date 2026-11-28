--
-- PostgreSQL database dump
--

\restrict vaKo2dP80mO1oL4j9fBdNNwBvQ7Dc6RmTH5Jl1VWiZ6GOv4pHpnw5fl9GokP6Pi

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.11

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: calificacion_utilidad; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.calificacion_utilidad AS ENUM (
    'util',
    'no_util'
);


--
-- Name: categoria_servicio_agencia; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.categoria_servicio_agencia AS ENUM (
    'desarrollo_ecommerce',
    'asesoria_venta_social',
    'ambas'
);


--
-- Name: estado_agencia; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.estado_agencia AS ENUM (
    'activo',
    'inactivo'
);


--
-- Name: estado_diagnostico; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.estado_diagnostico AS ENUM (
    'en_progreso',
    'completo'
);


--
-- Name: estado_transaccion_afiliado; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.estado_transaccion_afiliado AS ENUM (
    'enlace_generado',
    'conversion_reportada'
);


--
-- Name: etapa_emprendimiento; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.etapa_emprendimiento AS ENUM (
    'aun_no_vendo',
    'vendo_presencial',
    'vendo_y_crezco',
    'vendo_y_ordeno'
);


--
-- Name: modo_resultado_scoring; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.modo_resultado_scoring AS ENUM (
    'ganador_unico',
    'top_n'
);


--
-- Name: rango_presupuesto; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.rango_presupuesto AS ENUM (
    '$0',
    'hasta $25.000',
    '+$25.000'
);


--
-- Name: rango_productos; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.rango_productos AS ENUM (
    '1-10',
    '11-50',
    '+50'
);


--
-- Name: resultado_tipo_recomendacion; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.resultado_tipo_recomendacion AS ENUM (
    'ganador_unico',
    'top_n',
    'sin_recomendacion'
);


--
-- Name: rol_usuario; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.rol_usuario AS ENUM (
    'emprendedor',
    'agencia',
    'administrador'
);


--
-- Name: rubro_negocio; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.rubro_negocio AS ENUM (
    'ropa',
    'tecnologia',
    'artesania',
    'servicios',
    'comida'
);


--
-- Name: tipo_incorporacion_agencia; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.tipo_incorporacion_agencia AS ENUM (
    'curacion_manual',
    'postulacion_publica'
);


--
-- Name: tipo_transaccion_afiliado; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.tipo_transaccion_afiliado AS ENUM (
    'plataforma',
    'transportista'
);


--
-- Name: urgencia_envio; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.urgencia_envio AS ENUM (
    'baja',
    'media',
    'alta'
);


--
-- Name: actualizar_agencia(uuid, text, text, text, text, boolean, boolean, boolean, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.actualizar_agencia(p_agencia_id uuid, p_nombre text, p_categoria text, p_portafolio_url text, p_estado text, p_es_demo boolean, p_es_afiliado boolean, p_consentimiento boolean, p_correo_contacto text, p_nota_acuerdo text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
DECLARE
  v_nombre text := btrim(p_nombre);
  v_portafolio text := nullif(btrim(p_portafolio_url), '');
  v_correo text := nullif(btrim(p_correo_contacto), '');
  v_nota text := nullif(btrim(p_nota_acuerdo), '');
BEGIN
  IF NOT public.es_administrador() THEN
    RAISE EXCEPTION 'No autorizado: se requiere rol de administrador.' USING ERRCODE = '42501';
  END IF;

  IF p_agencia_id IS NULL OR NOT EXISTS (SELECT 1 FROM agencias WHERE id = p_agencia_id) THEN
    RAISE EXCEPTION 'La agencia indicada no existe.';
  END IF;
  IF v_nombre IS NULL OR length(v_nombre) < 1 OR length(v_nombre) > 100 THEN
    RAISE EXCEPTION 'El nombre de la agencia es obligatorio (máximo 100 caracteres).';
  END IF;
  IF p_categoria IS NULL OR NOT (p_categoria = ANY (enum_range(NULL::public.categoria_servicio_agencia)::text[])) THEN
    RAISE EXCEPTION 'La categoría de servicio no es válida.';
  END IF;
  IF p_estado IS NULL OR NOT (p_estado = ANY (enum_range(NULL::public.estado_agencia)::text[])) THEN
    RAISE EXCEPTION 'El estado no es válido.';
  END IF;
  IF v_portafolio IS NOT NULL AND (length(v_portafolio) > 500
     OR v_portafolio !~* '^https://[^/[:space:]]+\.[^/[:space:]]+(/[^[:space:]]*)?$') THEN
    RAISE EXCEPTION 'El portafolio debe comenzar con https:// y ser una dirección válida.';
  END IF;
  IF v_correo IS NOT NULL AND (length(v_correo) > 200
     OR v_correo !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$') THEN
    RAISE EXCEPTION 'El correo de contacto no es válido.';
  END IF;
  IF v_nota IS NOT NULL AND length(v_nota) > 500 THEN
    RAISE EXCEPTION 'La nota del acuerdo admite hasta 500 caracteres.';
  END IF;
  IF p_es_demo IS NULL OR p_es_afiliado IS NULL OR p_consentimiento IS NULL THEN
    RAISE EXCEPTION 'Faltan datos de la agencia.';
  END IF;
  IF EXISTS (SELECT 1 FROM agencias WHERE lower(nombre) = lower(v_nombre) AND id <> p_agencia_id) THEN
    RAISE EXCEPTION 'Ya existe una agencia con ese nombre.';
  END IF;

  -- Una agencia real que las personas verían necesita un correo de destino.
  IF p_estado = 'activo' AND p_consentimiento AND NOT p_es_demo AND v_correo IS NULL THEN
    RAISE EXCEPTION 'Una agencia real visible para las personas necesita un correo de contacto para poder reenviarle los contactos.';
  END IF;

  UPDATE agencias
  SET nombre = v_nombre,
      categoria_servicio = p_categoria::public.categoria_servicio_agencia,
      portafolio_url = v_portafolio,
      estado = p_estado::public.estado_agencia,
      consentimiento_registrado = p_consentimiento,
      es_demo = p_es_demo,
      es_afiliado = p_es_afiliado
  WHERE id = p_agencia_id;

  IF v_correo IS NULL AND v_nota IS NULL THEN
    DELETE FROM agencias_contacto_privado WHERE agencia_id = p_agencia_id;
  ELSE
    INSERT INTO agencias_contacto_privado (agencia_id, correo_contacto, nota_acuerdo)
    VALUES (p_agencia_id, v_correo, v_nota)
    ON CONFLICT (agencia_id) DO UPDATE
      SET correo_contacto = EXCLUDED.correo_contacto,
          nota_acuerdo = EXCLUDED.nota_acuerdo,
          fecha_actualizacion = now();
  END IF;

  RETURN true;
END;
$_$;


--
-- Name: actualizar_notas_plataforma(uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.actualizar_notas_plataforma(p_option_id uuid, p_notas jsonb) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
DECLARE
  v_categoria_id uuid;
  v_total_criterios integer;
  v_criterios_cubiertos integer;
  v_cambiadas integer;
BEGIN
  IF NOT public.es_administrador() THEN
    RAISE EXCEPTION 'No autorizado: se requiere rol de administrador.' USING ERRCODE = '42501';
  END IF;

  SELECT id INTO v_categoria_id FROM scoring_category WHERE nombre = 'Plataformas E-Commerce';
  IF v_categoria_id IS NULL THEN
    RAISE EXCEPTION 'No se encontró la categoría Plataformas E-Commerce.';
  END IF;

  IF p_option_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM scoring_option WHERE id = p_option_id AND categoria_id = v_categoria_id
  ) THEN
    RAISE EXCEPTION 'La plataforma indicada no existe.';
  END IF;

  IF p_notas IS NULL OR jsonb_typeof(p_notas) <> 'array' THEN
    RAISE EXCEPTION 'Las notas deben enviarse como una lista.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_notas) AS e
    WHERE jsonb_typeof(e) <> 'object'
       OR (e->>'criteria_id') IS NULL
       OR (e->>'criteria_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       OR (e->>'calificacion') IS NULL
       OR (e->>'calificacion') !~ '^[1-5]$'
  ) THEN
    RAISE EXCEPTION 'Cada nota debe indicar un criterio y una calificación entera de 1 a 5.';
  END IF;

  SELECT count(*) INTO v_total_criterios FROM scoring_criteria WHERE categoria_id = v_categoria_id;
  SELECT count(DISTINCT c.id) INTO v_criterios_cubiertos
  FROM jsonb_array_elements(p_notas) AS e
  JOIN scoring_criteria c ON c.id = (e->>'criteria_id')::uuid AND c.categoria_id = v_categoria_id;

  IF jsonb_array_length(p_notas) <> v_total_criterios OR v_criterios_cubiertos <> v_total_criterios THEN
    RAISE EXCEPTION 'Debe haber exactamente una nota por cada criterio (% en total), sin repetir ni agregar otros.', v_total_criterios;
  END IF;

  SELECT count(*) INTO v_cambiadas
  FROM jsonb_array_elements(p_notas) AS e
  LEFT JOIN scoring_option_rating r
    ON r.option_id = p_option_id AND r.criteria_id = (e->>'criteria_id')::uuid
  WHERE r.calificacion IS DISTINCT FROM (e->>'calificacion')::integer;

  IF v_cambiadas = 0 THEN
    RETURN 0;
  END IF;

  INSERT INTO scoring_option_rating (option_id, criteria_id, calificacion)
  SELECT p_option_id, (e->>'criteria_id')::uuid, (e->>'calificacion')::integer
  FROM jsonb_array_elements(p_notas) AS e
  ON CONFLICT (option_id, criteria_id) DO UPDATE SET calificacion = EXCLUDED.calificacion;

  RETURN v_cambiadas;
END;
$_$;


--
-- Name: actualizar_pesos_categoria(uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.actualizar_pesos_categoria(p_categoria_id uuid, p_pesos jsonb) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
DECLARE
  v_total_criterios integer;
  v_criterios_cubiertos integer;
  v_suma numeric;
  v_cambiados integer;
BEGIN
  IF NOT public.es_administrador() THEN
    RAISE EXCEPTION 'No autorizado: se requiere rol de administrador.' USING ERRCODE = '42501';
  END IF;

  IF p_categoria_id IS NULL OR NOT EXISTS (SELECT 1 FROM scoring_category WHERE id = p_categoria_id) THEN
    RAISE EXCEPTION 'La categoría indicada no existe.';
  END IF;

  IF p_pesos IS NULL OR jsonb_typeof(p_pesos) <> 'array' THEN
    RAISE EXCEPTION 'Los pesos deben enviarse como una lista.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_pesos) AS e
    WHERE jsonb_typeof(e) <> 'object'
       OR (e->>'criteria_id') IS NULL
       OR (e->>'criteria_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       OR (e->>'peso_base') IS NULL
       OR (e->>'peso_base') !~ '^(100|[1-9]?[0-9])$'
  ) THEN
    RAISE EXCEPTION 'Cada peso debe indicar un criterio y un número entero entre 0 y 100.';
  END IF;

  SELECT count(*) INTO v_total_criterios FROM scoring_criteria WHERE categoria_id = p_categoria_id;
  IF v_total_criterios = 0 THEN
    RAISE EXCEPTION 'La categoría no tiene criterios.';
  END IF;

  SELECT count(DISTINCT c.id) INTO v_criterios_cubiertos
  FROM jsonb_array_elements(p_pesos) AS e
  JOIN scoring_criteria c ON c.id = (e->>'criteria_id')::uuid AND c.categoria_id = p_categoria_id;

  IF jsonb_array_length(p_pesos) <> v_total_criterios OR v_criterios_cubiertos <> v_total_criterios THEN
    RAISE EXCEPTION 'Debe haber exactamente un peso por cada criterio de la categoría (% en total), sin repetir ni agregar otros.', v_total_criterios;
  END IF;

  SELECT sum((e->>'peso_base')::integer) INTO v_suma FROM jsonb_array_elements(p_pesos) AS e;
  IF v_suma IS DISTINCT FROM 100 THEN
    RAISE EXCEPTION 'Los pesos deben sumar exactamente 100 (suman %).', v_suma;
  END IF;

  SELECT count(*) INTO v_cambiados
  FROM jsonb_array_elements(p_pesos) AS e
  JOIN scoring_criteria c ON c.id = (e->>'criteria_id')::uuid
  WHERE c.peso_base IS DISTINCT FROM (e->>'peso_base')::integer;

  IF v_cambiados = 0 THEN
    RETURN 0;
  END IF;

  UPDATE scoring_criteria c
  SET peso_base = (e->>'peso_base')::integer
  FROM jsonb_array_elements(p_pesos) AS e
  WHERE c.id = (e->>'criteria_id')::uuid AND c.categoria_id = p_categoria_id;

  RETURN v_cambiados;
END;
$_$;


--
-- Name: crear_agencia(text, text, text, text, text, boolean, boolean, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.crear_agencia(p_nombre text, p_categoria text, p_portafolio_url text, p_correo_contacto text, p_nota_acuerdo text, p_es_demo boolean, p_es_afiliado boolean, p_consentimiento boolean) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
DECLARE
  v_nombre text := btrim(p_nombre);
  v_portafolio text := nullif(btrim(p_portafolio_url), '');
  v_correo text := nullif(btrim(p_correo_contacto), '');
  v_nota text := nullif(btrim(p_nota_acuerdo), '');
  v_id uuid;
BEGIN
  IF NOT public.es_administrador() THEN
    RAISE EXCEPTION 'No autorizado: se requiere rol de administrador.' USING ERRCODE = '42501';
  END IF;

  IF v_nombre IS NULL OR length(v_nombre) < 1 OR length(v_nombre) > 100 THEN
    RAISE EXCEPTION 'El nombre de la agencia es obligatorio (máximo 100 caracteres).';
  END IF;
  IF p_categoria IS NULL OR NOT (p_categoria = ANY (enum_range(NULL::public.categoria_servicio_agencia)::text[])) THEN
    RAISE EXCEPTION 'La categoría de servicio no es válida.';
  END IF;
  IF v_portafolio IS NOT NULL AND (length(v_portafolio) > 500
     OR v_portafolio !~* '^https://[^/[:space:]]+\.[^/[:space:]]+(/[^[:space:]]*)?$') THEN
    RAISE EXCEPTION 'El portafolio debe comenzar con https:// y ser una dirección válida.';
  END IF;
  IF v_correo IS NOT NULL AND (length(v_correo) > 200
     OR v_correo !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$') THEN
    RAISE EXCEPTION 'El correo de contacto no es válido.';
  END IF;
  IF v_nota IS NOT NULL AND length(v_nota) > 500 THEN
    RAISE EXCEPTION 'La nota del acuerdo admite hasta 500 caracteres.';
  END IF;
  IF p_es_demo IS NULL OR p_es_afiliado IS NULL OR p_consentimiento IS NULL THEN
    RAISE EXCEPTION 'Faltan datos de la agencia.';
  END IF;
  IF EXISTS (SELECT 1 FROM agencias WHERE lower(nombre) = lower(v_nombre)) THEN
    RAISE EXCEPTION 'Ya existe una agencia con ese nombre.';
  END IF;

  INSERT INTO agencias
    (nombre, categoria_servicio, portafolio_url, estado, consentimiento_registrado,
     tipo_incorporacion, es_demo, es_afiliado)
  VALUES
    (v_nombre, p_categoria::public.categoria_servicio_agencia, v_portafolio, 'inactivo',
     p_consentimiento, 'curacion_manual', p_es_demo, p_es_afiliado)
  RETURNING id INTO v_id;

  IF v_correo IS NOT NULL OR v_nota IS NOT NULL THEN
    INSERT INTO agencias_contacto_privado (agencia_id, correo_contacto, nota_acuerdo)
    VALUES (v_id, v_correo, v_nota);
  END IF;

  RETURN v_id;
END;
$_$;


--
-- Name: crear_plataforma(text, text, text, numeric, numeric, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.crear_plataforma(p_nombre text, p_enlace text, p_nombre_plan text, p_precio_mensual_clp numeric, p_comision_pct numeric, p_notas jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
DECLARE
  v_nombre text := btrim(p_nombre);
  v_enlace text := btrim(p_enlace);
  v_nombre_plan text := btrim(p_nombre_plan);
  v_categoria_id uuid;
  v_total_criterios integer;
  v_criterios_cubiertos integer;
  v_option_id uuid;
BEGIN
  IF NOT public.es_administrador() THEN
    RAISE EXCEPTION 'No autorizado: se requiere rol de administrador.' USING ERRCODE = '42501';
  END IF;

  IF v_nombre IS NULL OR length(v_nombre) < 1 OR length(v_nombre) > 60 THEN
    RAISE EXCEPTION 'El nombre de la plataforma es obligatorio (máximo 60 caracteres).';
  END IF;
  IF v_nombre_plan IS NULL OR length(v_nombre_plan) < 1 OR length(v_nombre_plan) > 100 THEN
    RAISE EXCEPTION 'El nombre del plan es obligatorio (máximo 100 caracteres).';
  END IF;
  IF v_enlace IS NULL OR length(v_enlace) > 500
     OR v_enlace !~* '^https://[^/[:space:]]+\.[^/[:space:]]+(/[^[:space:]]*)?$' THEN
    RAISE EXCEPTION 'El enlace de afiliado debe comenzar con https:// y ser una dirección válida.';
  END IF;
  IF p_precio_mensual_clp IS NULL OR p_precio_mensual_clp < 0
     OR p_precio_mensual_clp <> trunc(p_precio_mensual_clp) THEN
    RAISE EXCEPTION 'El precio mensual debe ser un número entero en pesos, mayor o igual a 0.';
  END IF;
  IF p_comision_pct IS NULL OR p_comision_pct < 0 OR p_comision_pct > 100 THEN
    RAISE EXCEPTION 'La comisión debe ser un número entre 0 y 100.';
  END IF;

  SELECT id INTO v_categoria_id FROM scoring_category WHERE nombre = 'Plataformas E-Commerce';
  IF v_categoria_id IS NULL THEN
    RAISE EXCEPTION 'No se encontró la categoría Plataformas E-Commerce.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM scoring_option
    WHERE categoria_id = v_categoria_id AND lower(nombre) = lower(v_nombre)
  ) THEN
    RAISE EXCEPTION 'Ya existe una plataforma con ese nombre.';
  END IF;

  IF p_notas IS NULL OR jsonb_typeof(p_notas) <> 'array' THEN
    RAISE EXCEPTION 'Las notas deben enviarse como una lista.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_notas) AS e
    WHERE jsonb_typeof(e) <> 'object'
       OR (e->>'criteria_id') IS NULL
       OR (e->>'criteria_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       OR (e->>'calificacion') IS NULL
       OR (e->>'calificacion') !~ '^[1-5]$'
  ) THEN
    RAISE EXCEPTION 'Cada nota debe indicar un criterio y una calificación entera de 1 a 5.';
  END IF;

  SELECT count(*) INTO v_total_criterios FROM scoring_criteria WHERE categoria_id = v_categoria_id;
  SELECT count(DISTINCT c.id) INTO v_criterios_cubiertos
  FROM jsonb_array_elements(p_notas) AS e
  JOIN scoring_criteria c ON c.id = (e->>'criteria_id')::uuid AND c.categoria_id = v_categoria_id;

  IF jsonb_array_length(p_notas) <> v_total_criterios OR v_criterios_cubiertos <> v_total_criterios THEN
    RAISE EXCEPTION 'Debe haber exactamente una nota por cada criterio (% en total), sin repetir ni agregar otros.', v_total_criterios;
  END IF;

  INSERT INTO scoring_option (categoria_id, nombre, activo, enlace_afiliado)
  VALUES (v_categoria_id, v_nombre, false, v_enlace)
  RETURNING id INTO v_option_id;

  INSERT INTO scoring_option_rating (option_id, criteria_id, calificacion)
  SELECT v_option_id, (e->>'criteria_id')::uuid, (e->>'calificacion')::integer
  FROM jsonb_array_elements(p_notas) AS e;

  INSERT INTO planes_plataforma (plataforma_option_id, nombre_plan, precio_mensual_clp, comision_transaccion_pct, fecha_vigencia)
  VALUES (v_option_id, v_nombre_plan, p_precio_mensual_clp, p_comision_pct, (now() AT TIME ZONE 'America/Santiago')::date);

  RETURN v_option_id;
END;
$_$;


--
-- Name: eliminar_diagnostico(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.eliminar_diagnostico(p_diagnostico_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'No autenticado' using errcode = '42501';
  end if;

  -- Solo el dueño puede eliminar; si no existe o no es suyo, devuelve false
  perform 1 from diagnosticos where id = p_diagnostico_id and usuario_id = v_uid for update;
  if not found then
    return false;
  end if;

  delete from informes_canvas where diagnostico_id = p_diagnostico_id;
  delete from recomendaciones where diagnostico_id = p_diagnostico_id;
  delete from contactos_agencia where diagnostico_id = p_diagnostico_id and reenviado = false;
  update calificaciones_utilidad set comentario = null where diagnostico_id = p_diagnostico_id;

  update diagnosticos d
  set usuario_id = null,
      sesion_anonima_id = null,
      canales_actuales = null,
      resultado = case
        when d.resultado is null then null
        else (
          select coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb)
          from jsonb_each(d.resultado) e
          where e.key in ('diagnosticoId', 'proveedorIA', 'generadoPorIA', 'fallosIA')
        )
      end,
      anonimizado_en = now(),
      fecha_actualizacion = now()
  where d.id = p_diagnostico_id;

  return true;
end;
$$;


--
-- Name: es_administrador(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.es_administrador() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE id = (SELECT auth.uid()) AND rol = 'administrador'
  );
$$;


--
-- Name: listar_agencias_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.listar_agencias_admin() RETURNS TABLE(agencia_id uuid, nombre text, categoria_servicio text, portafolio_url text, estado text, consentimiento_registrado boolean, es_demo boolean, es_afiliado boolean, fecha_incorporacion timestamp with time zone, correo_contacto text, nota_acuerdo text, visible_publico boolean)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
#variable_conflict use_column
BEGIN
  IF NOT public.es_administrador() THEN
    RAISE EXCEPTION 'No autorizado: se requiere rol de administrador.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT a.id, a.nombre, a.categoria_servicio::text, a.portafolio_url, a.estado::text,
         a.consentimiento_registrado, a.es_demo, a.es_afiliado, a.fecha_incorporacion,
         p.correo_contacto, p.nota_acuerdo,
         (a.estado = 'activo' AND (a.consentimiento_registrado OR a.es_demo))
  FROM agencias a
  LEFT JOIN agencias_contacto_privado p ON p.agencia_id = a.id
  ORDER BY a.nombre;
END;
$$;


--
-- Name: listar_contactos_agencias(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.listar_contactos_agencias() RETURNS TABLE(contacto_id uuid, fecha_contacto timestamp with time zone, agencia_id uuid, agencia_nombre text, agencia_es_demo boolean, agencia_correo_contacto text, reenviado boolean, fecha_reenvio timestamp with time zone, correo text, etapa text, tipo_producto text, cantidad_productos text, presupuesto_mensual text, zona_despacho text, urgencia_envio text, volumen_mensual text, plataforma_sugerida text, courier_sugerido text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
#variable_conflict use_column
BEGIN
  IF NOT public.es_administrador() THEN
    RAISE EXCEPTION 'No autorizado: se requiere rol de administrador.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT c.id, c.fecha_contacto, a.id, a.nombre, a.es_demo, p.correo_contacto, c.reenviado, c.fecha_reenvio,
         u.email::text,
         d.etapa_emprendimiento::text, d.tipo_producto::text, d.cantidad_productos::text,
         d.presupuesto_mensual::text, d.zona_despacho::text, d.urgencia_envio::text, d.volumen_mensual::text,
         (d.resultado->'plataforma'->>'nombre')::text,
         (d.resultado->'courier'->>'nombre')::text
  FROM contactos_agencia c
  JOIN agencias a ON a.id = c.agencia_id
  JOIN diagnosticos d ON d.id = c.diagnostico_id
  LEFT JOIN usuarios u ON u.id = d.usuario_id
  LEFT JOIN agencias_contacto_privado p ON p.agencia_id = a.id
  WHERE c.consentimiento_compartir
  ORDER BY c.fecha_contacto DESC;
END;
$$;


--
-- Name: marcar_contacto_reenviado(uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.marcar_contacto_reenviado(p_contacto_id uuid, p_reenviado boolean) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_filas integer;
BEGIN
  IF NOT public.es_administrador() THEN
    RAISE EXCEPTION 'No autorizado: se requiere rol de administrador.' USING ERRCODE = '42501';
  END IF;

  IF p_contacto_id IS NULL OR p_reenviado IS NULL THEN
    RAISE EXCEPTION 'Faltan datos para marcar el contacto.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM contactos_agencia c
    JOIN agencias a ON a.id = c.agencia_id
    WHERE c.id = p_contacto_id AND a.es_demo
  ) THEN
    RAISE EXCEPTION 'Las agencias de demostración no reciben contactos: no hay nada que reenviar.';
  END IF;

  UPDATE contactos_agencia
  SET reenviado = p_reenviado,
      fecha_reenvio = CASE WHEN p_reenviado THEN now() ELSE NULL END
  WHERE id = p_contacto_id;
  GET DIAGNOSTICS v_filas = ROW_COUNT;

  IF v_filas = 0 THEN
    RAISE EXCEPTION 'El contacto indicado no existe.';
  END IF;

  RETURN true;
END;
$$;


--
-- Name: obtener_kpis(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.obtener_kpis(p_dias integer DEFAULT NULL::integer) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_desde timestamptz;
  v_res   jsonb;
begin
  if not coalesce(public.es_administrador(), false) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if p_dias is not null and (p_dias < 1 or p_dias > 3650) then
    raise exception 'Período no válido';
  end if;

  v_desde := case
    when p_dias is null then '-infinity'::timestamptz
    else now() - make_interval(days => p_dias)
  end;

  with d as (
    select id, resultado
    from diagnosticos
    where fecha_creacion >= v_desde
  ),
  fallos as (
    select d.id, f
    from d,
    lateral jsonb_array_elements_text(
      case when jsonb_typeof(d.resultado->'fallosIA') = 'array'
           then d.resultado->'fallosIA' else '[]'::jsonb end
    ) as f
  )
  select jsonb_build_object(
    'periodo_dias', p_dias,
    'diagnosticos', jsonb_build_object(
      'total',                (select count(*) from d),
      'con_ia',               (select count(*) from d where d.resultado->>'generadoPorIA' = 'true'),
      'con_respaldo',         (select count(*) from d where d.resultado->>'generadoPorIA' = 'false'),
      'sin_dato_proveedor',   (select count(*) from d where d.resultado->>'proveedorIA' is null)
    ),
    'cuentas_creadas', (
      select count(*) from usuarios
      where fecha_registro >= v_desde and rol::text <> 'administrador'
    ),
    'clics', jsonb_build_object(
      'plataformas',    (select count(*) from transacciones_afiliado
                          where fecha >= v_desde and tipo::text = 'plataforma'),
      'transportistas', (select count(*) from transacciones_afiliado
                          where fecha >= v_desde and tipo::text = 'transportista')
    ),
    'contactos_agencia', (
      select count(*) from contactos_agencia where fecha_contacto >= v_desde
    ),
    'paso_a_paso_iniciado', (
      select count(*) from eventos_uso
      where tipo = 'paso_a_paso' and creado_en >= v_desde
    ),
    'descargas_pdf', (
      select count(*) from eventos_uso
      where tipo = 'descarga_pdf' and creado_en >= v_desde
    ),
    'ia', jsonb_build_object(
      'gemini', jsonb_build_object(
        'respondio', (select count(*) from d where d.resultado->>'proveedorIA' = 'gemini'),
        'fallo',     (select count(*) from fallos where f like 'gemini:%' and f <> 'gemini:sin_clave'),
        'motivos',   coalesce((select jsonb_object_agg(f, n) from (
                         select f, count(*) as n from fallos
                         where f like 'gemini:%' and f <> 'gemini:sin_clave'
                         group by f) x), '{}'::jsonb)
      ),
      'nvidia', jsonb_build_object(
        'respondio', (select count(*) from d where d.resultado->>'proveedorIA' = 'nvidia'),
        'fallo',     (select count(*) from fallos where f like 'nvidia:%' and f <> 'nvidia:sin_clave'),
        'motivos',   coalesce((select jsonb_object_agg(f, n) from (
                         select f, count(*) as n from fallos
                         where f like 'nvidia:%' and f <> 'nvidia:sin_clave'
                         group by f) x), '{}'::jsonb)
      ),
      'bloqueados_por_tope', (select count(*) from fallos where f like 'tope_%')
    )
  ) into v_res;

  return v_res;
end;
$$;


--
-- Name: reclamar_diagnosticos(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reclamar_diagnosticos(p_sesion_anonima_id text) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  cantidad integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN 0;
  END IF;

  UPDATE diagnosticos
  SET usuario_id = auth.uid()
  WHERE sesion_anonima_id = p_sesion_anonima_id
    AND usuario_id IS NULL;

  GET DIAGNOSTICS cantidad = ROW_COUNT;
  RETURN cantidad;
END;
$$;


--
-- Name: registrar_clic_afiliado(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.registrar_clic_afiliado(p_diagnostico_id uuid, p_option_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_categoria text;
  v_tipo public.tipo_transaccion_afiliado;
  v_filas integer;
BEGIN
  IF p_diagnostico_id IS NULL OR p_option_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT sc.nombre INTO v_categoria
  FROM scoring_option so
  JOIN scoring_category sc ON sc.id = so.categoria_id
  WHERE so.id = p_option_id AND so.activo;

  IF v_categoria = 'Plataformas E-Commerce' THEN
    v_tipo := 'plataforma';
  ELSIF v_categoria = 'Couriers y Logística' THEN
    v_tipo := 'transportista';
  ELSE
    RETURN false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM diagnosticos WHERE id = p_diagnostico_id) THEN
    RETURN false;
  END IF;

  INSERT INTO transacciones_afiliado (diagnostico_id, tipo, option_id)
  VALUES (p_diagnostico_id, v_tipo, p_option_id)
  ON CONFLICT (diagnostico_id, option_id) DO NOTHING;

  GET DIAGNOSTICS v_filas = ROW_COUNT;
  RETURN v_filas > 0;
END;
$$;


--
-- Name: registrar_contacto_agencia(uuid, uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.registrar_contacto_agencia(p_diagnostico_id uuid, p_agencia_id uuid, p_acepta_compartir boolean) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_usuario uuid := auth.uid();
  v_id uuid;
BEGIN
  IF v_usuario IS NULL THEN
    RAISE EXCEPTION 'No autorizado: se requiere iniciar sesión.' USING ERRCODE = '42501';
  END IF;

  IF p_acepta_compartir IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Debes aceptar compartir tus datos para contactar a una agencia.';
  END IF;

  IF p_diagnostico_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM diagnosticos
    WHERE id = p_diagnostico_id AND usuario_id = v_usuario AND estado = 'completo'
  ) THEN
    RAISE EXCEPTION 'El diagnóstico indicado no existe o no pertenece a tu cuenta.';
  END IF;

  IF p_agencia_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM agencias
    WHERE id = p_agencia_id AND estado = 'activo' AND (consentimiento_registrado OR es_demo)
  ) THEN
    RAISE EXCEPTION 'La agencia indicada no está disponible.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM contactos_agencia
    WHERE diagnostico_id = p_diagnostico_id AND agencia_id = p_agencia_id
  ) THEN
    RAISE EXCEPTION 'Ya contactaste a esta agencia con este diagnóstico.';
  END IF;

  INSERT INTO contactos_agencia (diagnostico_id, agencia_id, consentimiento_compartir)
  VALUES (p_diagnostico_id, p_agencia_id, true)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;


--
-- Name: registrar_evento_uso(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.registrar_evento_uso(p_diagnostico_id uuid, p_tipo text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_filas integer;
begin
  if p_diagnostico_id is null or p_tipo not in ('paso_a_paso', 'descarga_pdf') then
    return false;
  end if;

  if not exists (select 1 from diagnosticos where id = p_diagnostico_id) then
    return false;
  end if;

  insert into eventos_uso (diagnostico_id, tipo)
  values (p_diagnostico_id, p_tipo)
  on conflict (diagnostico_id, tipo) do nothing;

  get diagnostics v_filas = row_count;
  return v_filas > 0;
end;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: agencias; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agencias (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nombre text NOT NULL,
    categoria_servicio public.categoria_servicio_agencia NOT NULL,
    portafolio_url text,
    estado public.estado_agencia DEFAULT 'activo'::public.estado_agencia NOT NULL,
    consentimiento_registrado boolean DEFAULT false NOT NULL,
    tipo_incorporacion public.tipo_incorporacion_agencia DEFAULT 'curacion_manual'::public.tipo_incorporacion_agencia NOT NULL,
    fecha_incorporacion timestamp with time zone DEFAULT now(),
    es_demo boolean DEFAULT false NOT NULL,
    es_afiliado boolean DEFAULT false NOT NULL
);


--
-- Name: agencias_contacto_privado; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agencias_contacto_privado (
    agencia_id uuid NOT NULL,
    correo_contacto text,
    nota_acuerdo text,
    fecha_actualizacion timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT agencias_privado_correo_formato CHECK (((correo_contacto IS NULL) OR ((length(correo_contacto) <= 200) AND (correo_contacto ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'::text)))),
    CONSTRAINT agencias_privado_nota_largo CHECK (((nota_acuerdo IS NULL) OR (length(nota_acuerdo) <= 500)))
);


--
-- Name: calificaciones_utilidad; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.calificaciones_utilidad (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    diagnostico_id uuid NOT NULL,
    calificacion public.calificacion_utilidad NOT NULL,
    comentario text
);


--
-- Name: contactos_agencia; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contactos_agencia (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    diagnostico_id uuid NOT NULL,
    agencia_id uuid NOT NULL,
    fecha_contacto timestamp with time zone DEFAULT now(),
    consentimiento_compartir boolean DEFAULT false NOT NULL,
    reenviado boolean DEFAULT false NOT NULL,
    fecha_reenvio timestamp with time zone,
    CONSTRAINT contactos_reenvio_coherente CHECK (((reenviado AND (fecha_reenvio IS NOT NULL)) OR ((NOT reenviado) AND (fecha_reenvio IS NULL))))
);


--
-- Name: diagnosticos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.diagnosticos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    usuario_id uuid,
    etapa_emprendimiento text,
    tipo_producto text,
    cantidad_productos public.rango_productos,
    presupuesto_mensual text,
    canales_actuales text,
    zona_despacho text,
    urgencia_envio text,
    estado public.estado_diagnostico DEFAULT 'en_progreso'::public.estado_diagnostico,
    fecha_creacion timestamp with time zone DEFAULT now(),
    fecha_actualizacion timestamp with time zone DEFAULT now(),
    sesion_anonima_id text,
    volumen_mensual text,
    consentimiento_datos boolean DEFAULT false NOT NULL,
    fecha_consentimiento timestamp with time zone,
    resultado jsonb,
    anonimizado_en timestamp with time zone
);


--
-- Name: equivalencia_zona_courier; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.equivalencia_zona_courier (
    courier_option_id uuid NOT NULL,
    region text NOT NULL,
    comuna_principal text NOT NULL,
    zona_courier text NOT NULL
);


--
-- Name: eventos_uso; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.eventos_uso (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    diagnostico_id uuid NOT NULL,
    tipo text NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT eventos_uso_tipo_check CHECK ((tipo = ANY (ARRAY['paso_a_paso'::text, 'descarga_pdf'::text])))
);


--
-- Name: informes_canvas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.informes_canvas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    diagnostico_id uuid NOT NULL,
    contenido jsonb NOT NULL,
    generado_por_ia boolean DEFAULT true NOT NULL,
    plantilla_respaldo_id uuid,
    editado_por_usuario boolean DEFAULT false NOT NULL,
    fecha_generacion timestamp with time zone DEFAULT now()
);


--
-- Name: planes_plataforma; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.planes_plataforma (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    plataforma_option_id uuid NOT NULL,
    nombre_plan text NOT NULL,
    precio_mensual_clp numeric DEFAULT 0 NOT NULL,
    comision_transaccion_pct numeric DEFAULT 0 NOT NULL,
    fecha_vigencia date NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    CONSTRAINT planes_plataforma_comision_transaccion_pct_check CHECK (((comision_transaccion_pct >= (0)::numeric) AND (comision_transaccion_pct <= (100)::numeric))),
    CONSTRAINT planes_plataforma_precio_mensual_clp_check CHECK ((precio_mensual_clp >= (0)::numeric))
);


--
-- Name: plantillas_canvas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plantillas_canvas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    rubro public.rubro_negocio NOT NULL,
    contenido_base jsonb NOT NULL,
    activo boolean DEFAULT true NOT NULL
);


--
-- Name: rango_volumen_ventas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rango_volumen_ventas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    codigo text NOT NULL,
    etiqueta text NOT NULL,
    monto_minimo numeric NOT NULL,
    monto_maximo numeric,
    monto_referencia_clp numeric NOT NULL,
    fuente text NOT NULL
);


--
-- Name: recomendaciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recomendaciones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    diagnostico_id uuid NOT NULL,
    categoria_id uuid NOT NULL,
    resultado_tipo public.resultado_tipo_recomendacion NOT NULL,
    detalle jsonb NOT NULL,
    fecha_calculo timestamp with time zone DEFAULT now()
);


--
-- Name: scoring_category; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scoring_category (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nombre text NOT NULL,
    umbral_minimo numeric,
    modo_resultado public.modo_resultado_scoring DEFAULT 'ganador_unico'::public.modo_resultado_scoring NOT NULL
);


--
-- Name: scoring_criteria; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scoring_criteria (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    categoria_id uuid NOT NULL,
    nombre text NOT NULL,
    peso_base numeric NOT NULL,
    CONSTRAINT scoring_criteria_peso_base_check CHECK (((peso_base >= (0)::numeric) AND (peso_base <= (100)::numeric)))
);


--
-- Name: scoring_option; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scoring_option (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    categoria_id uuid NOT NULL,
    nombre text NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    enlace_afiliado text,
    es_afiliado boolean DEFAULT false NOT NULL
);


--
-- Name: scoring_option_rating; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scoring_option_rating (
    option_id uuid NOT NULL,
    criteria_id uuid NOT NULL,
    calificacion integer NOT NULL,
    CONSTRAINT scoring_option_rating_calificacion_check CHECK (((calificacion >= 1) AND (calificacion <= 5)))
);


--
-- Name: scoring_weight_rule; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scoring_weight_rule (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    criteria_id uuid NOT NULL,
    condicion text NOT NULL,
    ajuste_peso numeric NOT NULL,
    CONSTRAINT reglas_ajuste_rango CHECK (((ajuste_peso >= ('-20'::integer)::numeric) AND (ajuste_peso <= (20)::numeric)))
);


--
-- Name: tarifas_transporte; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tarifas_transporte (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    courier_option_id uuid NOT NULL,
    zona_origen text NOT NULL,
    zona_destino text NOT NULL,
    quiebre_peso text NOT NULL,
    tarifa numeric NOT NULL,
    fecha_vigencia date NOT NULL,
    servicio text NOT NULL,
    CONSTRAINT tarifas_fecha_no_futura CHECK ((fecha_vigencia <= CURRENT_DATE)),
    CONSTRAINT tarifas_transporte_tarifa_check CHECK ((tarifa >= (0)::numeric))
);


--
-- Name: transacciones_afiliado; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.transacciones_afiliado (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    diagnostico_id uuid NOT NULL,
    tipo public.tipo_transaccion_afiliado NOT NULL,
    option_id uuid NOT NULL,
    estado public.estado_transaccion_afiliado DEFAULT 'enlace_generado'::public.estado_transaccion_afiliado NOT NULL,
    fecha timestamp with time zone DEFAULT now()
);


--
-- Name: usuarios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usuarios (
    id uuid NOT NULL,
    email text NOT NULL,
    rol public.rol_usuario DEFAULT 'emprendedor'::public.rol_usuario,
    consentimiento_datos boolean DEFAULT false,
    fecha_consentimiento timestamp with time zone,
    fecha_registro timestamp with time zone DEFAULT now()
);


--
-- Name: agencias_contacto_privado agencias_contacto_privado_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agencias_contacto_privado
    ADD CONSTRAINT agencias_contacto_privado_pkey PRIMARY KEY (agencia_id);


--
-- Name: agencias agencias_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agencias
    ADD CONSTRAINT agencias_pkey PRIMARY KEY (id);


--
-- Name: calificaciones_utilidad calificaciones_utilidad_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calificaciones_utilidad
    ADD CONSTRAINT calificaciones_utilidad_pkey PRIMARY KEY (id);


--
-- Name: contactos_agencia contactos_agencia_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contactos_agencia
    ADD CONSTRAINT contactos_agencia_pkey PRIMARY KEY (id);


--
-- Name: contactos_agencia contactos_diagnostico_agencia_unico; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contactos_agencia
    ADD CONSTRAINT contactos_diagnostico_agencia_unico UNIQUE (diagnostico_id, agencia_id);


--
-- Name: diagnosticos diagnosticos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.diagnosticos
    ADD CONSTRAINT diagnosticos_pkey PRIMARY KEY (id);


--
-- Name: equivalencia_zona_courier equivalencia_zona_courier_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equivalencia_zona_courier
    ADD CONSTRAINT equivalencia_zona_courier_pkey PRIMARY KEY (courier_option_id, region);


--
-- Name: eventos_uso eventos_uso_diagnostico_id_tipo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eventos_uso
    ADD CONSTRAINT eventos_uso_diagnostico_id_tipo_key UNIQUE (diagnostico_id, tipo);


--
-- Name: eventos_uso eventos_uso_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eventos_uso
    ADD CONSTRAINT eventos_uso_pkey PRIMARY KEY (id);


--
-- Name: informes_canvas informes_canvas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.informes_canvas
    ADD CONSTRAINT informes_canvas_pkey PRIMARY KEY (id);


--
-- Name: planes_plataforma planes_plataforma_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.planes_plataforma
    ADD CONSTRAINT planes_plataforma_pkey PRIMARY KEY (id);


--
-- Name: plantillas_canvas plantillas_canvas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plantillas_canvas
    ADD CONSTRAINT plantillas_canvas_pkey PRIMARY KEY (id);


--
-- Name: rango_volumen_ventas rango_volumen_ventas_codigo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rango_volumen_ventas
    ADD CONSTRAINT rango_volumen_ventas_codigo_key UNIQUE (codigo);


--
-- Name: rango_volumen_ventas rango_volumen_ventas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rango_volumen_ventas
    ADD CONSTRAINT rango_volumen_ventas_pkey PRIMARY KEY (id);


--
-- Name: recomendaciones recomendaciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recomendaciones
    ADD CONSTRAINT recomendaciones_pkey PRIMARY KEY (id);


--
-- Name: scoring_category scoring_category_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scoring_category
    ADD CONSTRAINT scoring_category_pkey PRIMARY KEY (id);


--
-- Name: scoring_criteria scoring_criteria_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scoring_criteria
    ADD CONSTRAINT scoring_criteria_pkey PRIMARY KEY (id);


--
-- Name: scoring_option scoring_option_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scoring_option
    ADD CONSTRAINT scoring_option_pkey PRIMARY KEY (id);


--
-- Name: scoring_option_rating scoring_option_rating_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scoring_option_rating
    ADD CONSTRAINT scoring_option_rating_pkey PRIMARY KEY (option_id, criteria_id);


--
-- Name: scoring_weight_rule scoring_weight_rule_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scoring_weight_rule
    ADD CONSTRAINT scoring_weight_rule_pkey PRIMARY KEY (id);


--
-- Name: tarifas_transporte tarifas_transporte_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tarifas_transporte
    ADD CONSTRAINT tarifas_transporte_pkey PRIMARY KEY (id);


--
-- Name: transacciones_afiliado transacciones_afiliado_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transacciones_afiliado
    ADD CONSTRAINT transacciones_afiliado_pkey PRIMARY KEY (id);


--
-- Name: transacciones_afiliado transacciones_diagnostico_opcion_unico; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transacciones_afiliado
    ADD CONSTRAINT transacciones_diagnostico_opcion_unico UNIQUE (diagnostico_id, option_id);


--
-- Name: usuarios usuarios_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_email_key UNIQUE (email);


--
-- Name: usuarios usuarios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_pkey PRIMARY KEY (id);


--
-- Name: agencias_nombre_unico; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX agencias_nombre_unico ON public.agencias USING btree (lower(nombre));


--
-- Name: agencias_contacto_privado agencias_contacto_privado_agencia_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agencias_contacto_privado
    ADD CONSTRAINT agencias_contacto_privado_agencia_id_fkey FOREIGN KEY (agencia_id) REFERENCES public.agencias(id) ON DELETE CASCADE;


--
-- Name: calificaciones_utilidad calificaciones_utilidad_diagnostico_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calificaciones_utilidad
    ADD CONSTRAINT calificaciones_utilidad_diagnostico_id_fkey FOREIGN KEY (diagnostico_id) REFERENCES public.diagnosticos(id) ON DELETE CASCADE;


--
-- Name: contactos_agencia contactos_agencia_agencia_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contactos_agencia
    ADD CONSTRAINT contactos_agencia_agencia_id_fkey FOREIGN KEY (agencia_id) REFERENCES public.agencias(id) ON DELETE CASCADE;


--
-- Name: contactos_agencia contactos_agencia_diagnostico_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contactos_agencia
    ADD CONSTRAINT contactos_agencia_diagnostico_id_fkey FOREIGN KEY (diagnostico_id) REFERENCES public.diagnosticos(id) ON DELETE CASCADE;


--
-- Name: diagnosticos diagnosticos_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.diagnosticos
    ADD CONSTRAINT diagnosticos_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;


--
-- Name: equivalencia_zona_courier equivalencia_zona_courier_courier_option_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equivalencia_zona_courier
    ADD CONSTRAINT equivalencia_zona_courier_courier_option_id_fkey FOREIGN KEY (courier_option_id) REFERENCES public.scoring_option(id) ON DELETE CASCADE;


--
-- Name: eventos_uso eventos_uso_diagnostico_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eventos_uso
    ADD CONSTRAINT eventos_uso_diagnostico_id_fkey FOREIGN KEY (diagnostico_id) REFERENCES public.diagnosticos(id) ON DELETE CASCADE;


--
-- Name: informes_canvas informes_canvas_diagnostico_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.informes_canvas
    ADD CONSTRAINT informes_canvas_diagnostico_id_fkey FOREIGN KEY (diagnostico_id) REFERENCES public.diagnosticos(id) ON DELETE CASCADE;


--
-- Name: informes_canvas informes_canvas_plantilla_respaldo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.informes_canvas
    ADD CONSTRAINT informes_canvas_plantilla_respaldo_id_fkey FOREIGN KEY (plantilla_respaldo_id) REFERENCES public.plantillas_canvas(id);


--
-- Name: planes_plataforma planes_plataforma_plataforma_option_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.planes_plataforma
    ADD CONSTRAINT planes_plataforma_plataforma_option_id_fkey FOREIGN KEY (plataforma_option_id) REFERENCES public.scoring_option(id) ON DELETE CASCADE;


--
-- Name: recomendaciones recomendaciones_categoria_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recomendaciones
    ADD CONSTRAINT recomendaciones_categoria_id_fkey FOREIGN KEY (categoria_id) REFERENCES public.scoring_category(id);


--
-- Name: recomendaciones recomendaciones_diagnostico_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recomendaciones
    ADD CONSTRAINT recomendaciones_diagnostico_id_fkey FOREIGN KEY (diagnostico_id) REFERENCES public.diagnosticos(id) ON DELETE CASCADE;


--
-- Name: scoring_criteria scoring_criteria_categoria_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scoring_criteria
    ADD CONSTRAINT scoring_criteria_categoria_id_fkey FOREIGN KEY (categoria_id) REFERENCES public.scoring_category(id) ON DELETE CASCADE;


--
-- Name: scoring_option scoring_option_categoria_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scoring_option
    ADD CONSTRAINT scoring_option_categoria_id_fkey FOREIGN KEY (categoria_id) REFERENCES public.scoring_category(id) ON DELETE CASCADE;


--
-- Name: scoring_option_rating scoring_option_rating_criteria_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scoring_option_rating
    ADD CONSTRAINT scoring_option_rating_criteria_id_fkey FOREIGN KEY (criteria_id) REFERENCES public.scoring_criteria(id) ON DELETE CASCADE;


--
-- Name: scoring_option_rating scoring_option_rating_option_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scoring_option_rating
    ADD CONSTRAINT scoring_option_rating_option_id_fkey FOREIGN KEY (option_id) REFERENCES public.scoring_option(id) ON DELETE CASCADE;


--
-- Name: scoring_weight_rule scoring_weight_rule_criteria_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scoring_weight_rule
    ADD CONSTRAINT scoring_weight_rule_criteria_id_fkey FOREIGN KEY (criteria_id) REFERENCES public.scoring_criteria(id) ON DELETE CASCADE;


--
-- Name: tarifas_transporte tarifas_transporte_courier_option_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tarifas_transporte
    ADD CONSTRAINT tarifas_transporte_courier_option_id_fkey FOREIGN KEY (courier_option_id) REFERENCES public.scoring_option(id) ON DELETE CASCADE;


--
-- Name: transacciones_afiliado transacciones_afiliado_diagnostico_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transacciones_afiliado
    ADD CONSTRAINT transacciones_afiliado_diagnostico_id_fkey FOREIGN KEY (diagnostico_id) REFERENCES public.diagnosticos(id) ON DELETE CASCADE;


--
-- Name: transacciones_afiliado transacciones_afiliado_option_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transacciones_afiliado
    ADD CONSTRAINT transacciones_afiliado_option_id_fkey FOREIGN KEY (option_id) REFERENCES public.scoring_option(id);


--
-- Name: usuarios usuarios_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: planes_plataforma admin_inserta_planes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_inserta_planes ON public.planes_plataforma FOR INSERT TO authenticated WITH CHECK (( SELECT public.es_administrador() AS es_administrador));


--
-- Name: scoring_option admin_modifica_opciones; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_modifica_opciones ON public.scoring_option FOR UPDATE TO authenticated USING (( SELECT public.es_administrador() AS es_administrador)) WITH CHECK (( SELECT public.es_administrador() AS es_administrador));


--
-- Name: planes_plataforma admin_modifica_planes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_modifica_planes ON public.planes_plataforma FOR UPDATE TO authenticated USING (( SELECT public.es_administrador() AS es_administrador)) WITH CHECK (( SELECT public.es_administrador() AS es_administrador));


--
-- Name: scoring_weight_rule admin_modifica_reglas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_modifica_reglas ON public.scoring_weight_rule FOR UPDATE TO authenticated USING (( SELECT public.es_administrador() AS es_administrador)) WITH CHECK (( SELECT public.es_administrador() AS es_administrador));


--
-- Name: tarifas_transporte admin_modifica_tarifas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_modifica_tarifas ON public.tarifas_transporte FOR UPDATE TO authenticated USING (( SELECT public.es_administrador() AS es_administrador)) WITH CHECK (( SELECT public.es_administrador() AS es_administrador));


--
-- Name: agencias; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agencias ENABLE ROW LEVEL SECURITY;

--
-- Name: agencias_contacto_privado; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agencias_contacto_privado ENABLE ROW LEVEL SECURITY;

--
-- Name: agencias agencias_lectura_publica; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY agencias_lectura_publica ON public.agencias FOR SELECT TO authenticated, anon USING (((estado = 'activo'::public.estado_agencia) AND (consentimiento_registrado OR es_demo)));


--
-- Name: calificaciones_utilidad; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.calificaciones_utilidad ENABLE ROW LEVEL SECURITY;

--
-- Name: contactos_agencia; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.contactos_agencia ENABLE ROW LEVEL SECURITY;

--
-- Name: contactos_agencia contactos_leer_propios; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY contactos_leer_propios ON public.contactos_agencia FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.diagnosticos d
  WHERE ((d.id = contactos_agencia.diagnostico_id) AND (d.usuario_id = ( SELECT auth.uid() AS uid))))));


--
-- Name: diagnosticos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.diagnosticos ENABLE ROW LEVEL SECURITY;

--
-- Name: diagnosticos diagnosticos_leer_propios; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY diagnosticos_leer_propios ON public.diagnosticos FOR SELECT TO authenticated USING ((usuario_id = ( SELECT auth.uid() AS uid)));


--
-- Name: equivalencia_zona_courier; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.equivalencia_zona_courier ENABLE ROW LEVEL SECURITY;

--
-- Name: eventos_uso; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.eventos_uso ENABLE ROW LEVEL SECURITY;

--
-- Name: informes_canvas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.informes_canvas ENABLE ROW LEVEL SECURITY;

--
-- Name: planes_plataforma lectura_publica; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lectura_publica ON public.planes_plataforma FOR SELECT TO authenticated, anon USING (true);


--
-- Name: rango_volumen_ventas lectura_publica; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lectura_publica ON public.rango_volumen_ventas FOR SELECT TO authenticated, anon USING (true);


--
-- Name: scoring_category lectura_publica; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lectura_publica ON public.scoring_category FOR SELECT TO authenticated, anon USING (true);


--
-- Name: scoring_criteria lectura_publica; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lectura_publica ON public.scoring_criteria FOR SELECT TO authenticated, anon USING (true);


--
-- Name: scoring_option lectura_publica; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lectura_publica ON public.scoring_option FOR SELECT TO authenticated, anon USING (true);


--
-- Name: scoring_option_rating lectura_publica; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lectura_publica ON public.scoring_option_rating FOR SELECT TO authenticated, anon USING (true);


--
-- Name: scoring_weight_rule lectura_publica; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lectura_publica ON public.scoring_weight_rule FOR SELECT TO authenticated, anon USING (true);


--
-- Name: tarifas_transporte lectura_publica; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lectura_publica ON public.tarifas_transporte FOR SELECT TO authenticated, anon USING (true);


--
-- Name: planes_plataforma; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.planes_plataforma ENABLE ROW LEVEL SECURITY;

--
-- Name: plantillas_canvas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.plantillas_canvas ENABLE ROW LEVEL SECURITY;

--
-- Name: rango_volumen_ventas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.rango_volumen_ventas ENABLE ROW LEVEL SECURITY;

--
-- Name: recomendaciones; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.recomendaciones ENABLE ROW LEVEL SECURITY;

--
-- Name: scoring_category; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.scoring_category ENABLE ROW LEVEL SECURITY;

--
-- Name: scoring_criteria; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.scoring_criteria ENABLE ROW LEVEL SECURITY;

--
-- Name: scoring_option; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.scoring_option ENABLE ROW LEVEL SECURITY;

--
-- Name: scoring_option_rating; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.scoring_option_rating ENABLE ROW LEVEL SECURITY;

--
-- Name: scoring_weight_rule; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.scoring_weight_rule ENABLE ROW LEVEL SECURITY;

--
-- Name: tarifas_transporte; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tarifas_transporte ENABLE ROW LEVEL SECURITY;

--
-- Name: transacciones_afiliado; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.transacciones_afiliado ENABLE ROW LEVEL SECURITY;

--
-- Name: usuarios; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

--
-- Name: usuarios usuarios_crear_propio; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY usuarios_crear_propio ON public.usuarios FOR INSERT TO authenticated WITH CHECK (((id = ( SELECT auth.uid() AS uid)) AND (rol = 'emprendedor'::public.rol_usuario)));


--
-- Name: usuarios usuarios_leer_propio; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY usuarios_leer_propio ON public.usuarios FOR SELECT TO authenticated USING ((id = ( SELECT auth.uid() AS uid)));


--
-- PostgreSQL database dump complete
--

\unrestrict vaKo2dP80mO1oL4j9fBdNNwBvQ7Dc6RmTH5Jl1VWiZ6GOv4pHpnw5fl9GokP6Pi

