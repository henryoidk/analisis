# Levantamiento y Análisis de Requerimientos

Este documento detalla el proceso para levantar, analizar y documentar los requerimientos de un sistema, siguiendo una secuencia lógica desde la definición de la visión hasta el cierre del análisis.

---

## 1. Definir la Visión y Objetivos

**Qué hacer:** redactar en 3–5 líneas el problema y el resultado esperado.  
Convierte los objetivos en formato **SMART** (específicos, medibles, alcanzables, relevantes y con tiempo).  

**Entregables:**  
- Declaración de visión.  
- Objetivos SMART.

---

## 2. Identificar Stakeholders

**Qué hacer:** lista quiénes se ven afectados o interactúan (usuarios finales, dueños de proceso, TI, seguridad, legal, sistemas externos).  

**Entregables:**  
- Mapa de stakeholders (rol, interés, influencia, disponibilidad).

---

## 3. Delimitar Alcance (Scope) y Contexto

**Qué hacer:** define qué sí y qué no entra en el proyecto.  
Dibuja un diagrama de contexto o caso de uso general (sistema ↔ actores externos).  

**Entregables:**  
- Declaración de alcance.  
- Supuestos y restricciones.  
- Riesgos iniciales.

---

## 4. Plan de Elicitación

**Qué hacer:** define cómo obtendrás la información necesaria. Selecciona técnicas apropiadas como entrevistas, talleres, revisión documental, observación, encuestas, prototipos o análisis de sistemas actuales (**AS-IS**).  

**Entregables:**  
- Agenda.  
- Guías de entrevista.  
- Instrumentos de encuesta.  
- Lista de documentos a revisar.

---

## 5. Elicitación (Recopilación)

**Qué hacer:** ejecuta entrevistas y talleres; observa el trabajo real; captura dolores, oportunidades, reglas de negocio y excepciones.  

**Entregables:**  
- Minutas.  
- Hallazgos.  
- “Pain points”.  
- Requisitos candidatos.

---

## 6. Modelado Rápido del Negocio (AS-IS → TO-BE)

**Qué hacer:** esquematiza los procesos actuales (**AS-IS**) y los procesos deseados (**TO-BE**). Identifica los cambios clave.  

**Entregables:**  
- Diagramas simples de procesos.  
- Lista de mejoras propuestas.

---

## 7. Redacción y Estructuración de Requerimientos

**Qué hacer:** transforma los hallazgos en los siguientes tipos de requerimientos:

- **Requerimientos Funcionales (RF):** servicios que el sistema debe brindar.  
- **Requerimientos No Funcionales (RNF):** aspectos de calidad como rendimiento, seguridad, usabilidad, disponibilidad y cumplimiento.  
- **Datos:** entidades, atributos, catálogos y validaciones.  
- **Reglas de Negocio:** políticas que gobiernan decisiones.  
- **Historias de Usuario:** formuladas con el principio **INVEST** y criterios de aceptación en formato **Gherkin (Given/When/Then)**.

**Entregables:**  
- Especificación de requerimientos (borrador).  
- Catálogo de datos.  
- Reglas de negocio.

---

## 8. Priorización y Planificación

**Qué hacer:** aplica técnicas de priorización como **MoSCoW** (Must, Should, Could, Won’t) o matriz **valor vs. esfuerzo**.  
Define releases o sprints según las prioridades.  

**Entregables:**  
- Backlog priorizado con estimaciones y dependencias.

---

## 9. Validación con Stakeholders

**Qué hacer:** revisa los requisitos con usuarios y stakeholders mediante walkthroughs o revisiones colaborativas. Valida los criterios de aceptación y los prototipos de baja fidelidad.  

**Entregables:**  
- Requisitos validados y firmados (baseline).  
- Registro de decisiones.

---

## 10. Trazabilidad y Gestión de Cambios

**Qué hacer:** crea una matriz de trazabilidad que relacione:  
**Necesidad → RF/RNF → Caso de uso → Criterios de aceptación → Prueba.**  
Define un procedimiento de control de versiones y gestión de cambios.  

**Entregables:**  
- Matriz de trazabilidad.  
- Procedimiento formal de cambios.

---

## 11. Cierre del Análisis

**Qué hacer:** consolida la versión final de los requerimientos, empaqueta artefactos y documenta los riesgos residuales. Comunica el alcance final a todas las partes involucradas.  

**Entregables:**  
- Paquete de requisitos versión 1.0 (baseline).  
- Acta de acuerdos finales.

---

**Versión del documento:** 1.0  
**Fecha:** 4 de noviembre de 2025  
**Autor:** Equipo de Análisis de Requerimientos
