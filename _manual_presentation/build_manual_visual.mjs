import fs from 'node:fs/promises';
import { Presentation, PresentationFile } from '@oai/artifact-tool';

const OUT = 'C:/IncaMant/Manual_Visual_INCAMAT.pptx';
const OUTDIR = 'C:/IncaMant/_manual_presentation/out';
const W = 1280, H = 720;
const C = { navy:'#0B2545', blue:'#1B8BCB', aqua:'#DFF4FF', pale:'#F5F8FC', ink:'#16345B', muted:'#5D718A', line:'#D4E0EC', green:'#299565', gold:'#D69116', red:'#D6524B', purple:'#7651B8', white:'#FFFFFF' };

function text(slide, value, x, y, w, h, size=20, bold=false, color=C.ink, align='left') {
  const s=slide.shapes.add({geometry:'textbox', position:{left:x,top:y,width:w,height:h},fill:'none',line:{style:'solid',fill:'none',width:0}});
  s.text=value; s.text.style={fontSize:size,bold,color,alignment:align,fontFace:'Arial'};
  return s;
}
function box(slide,x,y,w,h,fill=C.white,r=18,line=C.line) {
  return slide.shapes.add({geometry:r?'roundRect':'rect',position:{left:x,top:y,width:w,height:h},fill,line:{style:'solid',fill:line,width:1},borderRadius:r?'rounded-xl':undefined});
}
function rule(slide,x,y,w,color=C.line){return slide.shapes.add({geometry:'rect',position:{left:x,top:y,width:w,height:2},fill:color,line:{style:'solid',fill:color,width:0}})}
function page(slide,n,label='MANUAL VISUAL'){
  text(slide,label,64,674,300,18,10,true,C.muted);
  text(slide,String(n).padStart(2,'0'),1160,672,56,20,11,true,C.muted,'right');
}
function heading(slide,eyebrow,title,subtitle,n){
  text(slide,eyebrow.toUpperCase(),64,48,500,22,13,true,C.blue);
  text(slide,title,64,80,900,54,35,true,C.navy);
  if(subtitle) text(slide,subtitle,64,140,970,42,18,false,C.muted);
  rule(slide,64,196,1152);
  page(slide,n);
}
function badge(slide,label,x,y,fill=C.aqua,color=C.blue,w=142){box(slide,x,y,w,34,fill,12,fill);text(slide,label,x+12,y+8,w-24,18,12,true,color,'center')}
function step(slide,no,title,detail,x,y,w=260,color=C.blue){
  box(slide,x,y,w,152,C.white,18,C.line); box(slide,x+18,y+18,38,38,color,12,color); text(slide,String(no),x+18,y+25,38,22,16,true,C.white,'center');
  text(slide,title,x+18,y+70,w-36,30,18,true,C.navy); text(slide,detail,x+18,y+105,w-36,34,13,false,C.muted);
}
function bullet(slide, value, x, y, w, color=C.blue){
  box(slide,x,y+5,10,10,color,5,color); text(slide,value,x+24,y,w,30,17,false,C.ink);
}

const p=Presentation.create({slideSize:{width:W,height:H}});

// 1 Cover
{const s=p.slides.add();s.background.fill=C.pale;
 box(s,64,52,1152,616,C.white,24,C.line); box(s,64,52,28,616,C.blue,0,C.blue);
 text(s,'INCAMAT',130,132,680,70,54,true,C.navy); text(s,'Manual visual de uso',130,207,650,44,31,true,C.blue);
 text(s,'Gestión de activos, mantenimiento e inventario técnico\nPlanta Incalpaca TPX',130,276,570,70,21,false,C.muted);
 rule(s,130,378,448,C.line);
 text(s,'Aprende el flujo completo:\nreportar · atender · controlar · analizar',130,408,500,76,22,true,C.ink);
 box(s,775,155,300,300,C.aqua,30,C.aqua); text(s,'01',822,211,205,70,56,true,C.blue,'center'); text(s,'Una sola plataforma\npara la operación',810,300,230,65,23,true,C.navy,'center');
 text(s,'Guía para operarios, técnicos, ingenieros y administradores',130,598,720,18,14,false,C.muted); page(s,1,'INCAMAT · GUÍA DE USO');}

// 2 audience and flow
{const s=p.slides.add(); s.background.fill=C.white; heading(s,'¿Para quién es?','Cada perfil realiza una parte del proceso','INCAMAT conecta el reporte desde planta con la atención técnica y el control administrativo.',2);
 const roles=[['Operario','Reporta la falla\ndesde QR o formulario.',C.blue],['Técnico','Inicia, atiende y\ncierra la orden.',C.green],['Ingeniero','Planifica, importa\ny revisa indicadores.',C.purple],['Administrador','Gestiona usuarios\ny datos maestros.',C.gold]];
 roles.forEach((r,i)=>{const x=64+i*288;box(s,x,248,248,235,C.pale,18,C.line);box(s,x+20,268,54,54,r[2],14,r[2]);text(s,String(i+1),x+20,282,54,24,18,true,C.white,'center');text(s,r[0],x+20,346,200,28,21,true,C.navy);text(s,r[1],x+20,384,205,50,16,false,C.muted);});
 text(s,'Resultado: cada acción queda vinculada a la máquina, área, orden y repuesto correspondiente.',64,556,1020,30,20,true,C.ink);}

// 3 Navigation
{const s=p.slides.add();s.background.fill=C.pale;heading(s,'Navegación','El menú guía el trabajo diario','Elija el módulo según la tarea que necesita realizar.',3);
 const rows=[['Dashboard','Ver alertas, KPIs e historial.'],['Reportes de planta','Registrar una incidencia o abrir el reporte QR.'],['Órdenes y planificación','Atender correctivos y programar preventivos.'],['Áreas y máquinas','Ubicar activos, consultar ficha y QR.'],['Repuestos e importaciones','Controlar abastecimiento, solicitudes y archivos Excel.']];
 rows.forEach((r,i)=>{const y=230+i*72;box(s,84,y,320,52,C.navy,12,C.navy);text(s,r[0],104,y+15,270,20,17,true,C.white);text(s,r[1],444,y+13,680,24,17,false,C.ink);rule(s,444,y+50,660,C.line);});
 badge(s,'EMPIEZA AQUÍ',967,230,C.aqua,C.blue,170); text(s,'Identifique si va a\nreportar, atender o\nconsultar información.',930,300,210,90,20,true,C.navy,'center');}

// 4 Dashboard
{const s=p.slides.add();s.background.fill=C.white;heading(s,'Paso 1','Revisa el panel de control antes de intervenir','El Dashboard permite reconocer qué requiere atención y qué información ya está disponible.',4);
 const cards=[['Máquinas registradas','703',C.blue],['Máquinas paradas','0',C.red],['Repuestos bajo mínimo','0',C.gold],['Fallas abiertas','0',C.purple]];
 cards.forEach((c,i)=>{const x=64+i*284;box(s,x,240,256,150,C.pale,18,C.line);box(s,x+20,260,44,44,c[2],14,c[2]);text(s,c[1],x+80,260,145,43,34,true,C.navy);text(s,c[0],x+20,330,210,22,14,false,C.muted);});
 box(s,64,442,720,152,C.aqua,18,C.aqua); text(s,'Qué mirar primero',88,464,310,28,22,true,C.navy); bullet(s,'Máquinas paradas y su motivo.',90,507,420,C.blue);bullet(s,'Repuestos bajo mínimo o sin verificar.',90,545,440,C.gold);
 box(s,816,442,400,152,C.white,18,C.line);text(s,'KPIs e historial',840,464,260,28,22,true,C.navy);text(s,'Filtra las actividades por día, semana, mes, año o todo el historial.',840,510,340,50,17,false,C.muted);}

// 5 QR report
{const s=p.slides.add();s.background.fill=C.pale;heading(s,'Paso 2','Reporta una falla desde la máquina','El QR abre el equipo correcto para evitar errores al seleccionar el activo.',5);
 step(s,1,'Escanea el QR','Ubica el código en la ficha o la máquina.',64,250,260,C.blue); step(s,2,'Completa el reporte','Elige área, máquina, prioridad y fecha.',360,250,260,C.green); step(s,3,'Adjunta evidencia','Describe lo observado y sube una foto.',656,250,260,C.gold); step(s,4,'Envía','La incidencia pasa a la bandeja técnica.',952,250,260,C.purple);
 box(s,174,495,932,90,C.white,18,C.line);text(s,'Prioridad: Baja = programable · Media = revisión · Alta = atención prioritaria · Crítica = parada o riesgo.',205,526,870,25,18,true,C.ink,'center');}

// 6 Work order
{const s=p.slides.add();s.background.fill=C.white;heading(s,'Paso 3','El técnico documenta toda la atención','La orden no solo cambia de estado: conserva hora, evidencia, diagnóstico, trabajo y repuestos.',6);
 const proc=[['1','Iniciar','Registra hora real y activa el cronómetro.',C.blue],['2','Diagnosticar','Indica causa: mecánica, eléctrica, electrónica u otra.',C.gold],['3','Ejecutar','Registra trabajo realizado y repuestos usados.',C.purple],['4','Cerrar','Sube foto final, prueba y hora de cierre.',C.green]];
 proc.forEach((a,i)=>{const x=64+i*286;box(s,x,245,258,244,C.pale,18,C.line);text(s,a[0],x+20,266,48,36,28,true,a[3]);text(s,a[1],x+20,322,205,30,21,true,C.navy);text(s,a[2],x+20,370,208,70,16,false,C.muted);});
 text(s,'Si la prueba final es operativa, la máquina vuelve a ese estado. Si requiere seguimiento, queda registrada para revisión.',64,560,1140,28,19,true,C.ink);}

// 7 Planning
{const s=p.slides.add();s.background.fill=C.pale;heading(s,'Paso 4','Planifica mantenimientos sin perder el contexto','Usa el centro de mantenimiento para organizar correctivos y tareas programadas.',7);
 const items=[['Preventivo planificado','Tareas calendarizadas para conservar el equipo.',C.blue],['Autónomo','Checklist diario del personal operativo.',C.green],['Predictivo','Acción según condición o medición.',C.purple],['Proactivo','Mejora orientada a eliminar causa raíz.',C.gold]];
 items.forEach((a,i)=>{const x=64+(i%2)*584;const y=240+Math.floor(i/2)*150;box(s,x,y,552,118,C.white,18,C.line);box(s,x+20,y+24,12,70,a[2],6,a[2]);text(s,a[0],x+55,y+25,330,25,20,true,C.navy);text(s,a[0]==='Preventivo planificado'?'Se agenda y se controla por fecha.':a[1],x+55,y+64,430,35,16,false,C.muted);});
 text(s,'Puedes filtrar por área, prioridad y estado para ordenar la bandeja de trabajo.',64,574,1000,26,19,true,C.ink);}

// 8 Machines / areas
{const s=p.slides.add();s.background.fill=C.white;heading(s,'Paso 5','Ubica la máquina antes de actuar','La estructura planta → área → máquina evita registros duplicados y permite conocer el contexto del activo.',8);
 box(s,64,248,340,280,C.aqua,20,C.aqua);text(s,'PLANTA',94,278,230,30,22,true,C.blue);text(s,'Incalpaca TPX',94,320,260,38,30,true,C.navy);text(s,'ÁREA',94,395,230,20,16,true,C.muted);text(s,'Acabado de Telas',94,425,260,30,23,true,C.navy);
 box(s,456,248,760,280,C.pale,20,C.line);text(s,'Ficha de máquina',490,278,330,30,24,true,C.navy);rule(s,490,320,670);text(s,'Nombre · Marca · Modelo · Estado · Código interno · Descripción',490,346,680,26,18,false,C.ink);text(s,'Código QR para identificación y reporte desde planta',490,394,600,30,19,true,C.blue);box(s,1055,338,95,95,C.white,10,C.line);text(s,'QR',1068,367,68,28,20,true,C.navy,'center');
 text(s,'Consejo: antes de crear un área o máquina, busca por código y nombre para evitar duplicados.',64,582,1120,28,18,true,C.ink);}

// 9 stopped
{const s=p.slides.add();s.background.fill=C.pale;heading(s,'Paso 6','Gestiona las máquinas paradas con una causa clara','Este módulo concentra los equipos detenidos o en mantenimiento para priorizar el retorno a operación.',9);
 const cols=[['Máquina / área','Identifica dónde está el impacto.'],['Motivo','Falla, orden pendiente o espera de repuesto.'],['Estado','Pendiente · en atención · esperando repuesto · resuelta.'],['Acción','Abrir orden, solicitar repuesto o registrar avance.']];
 cols.forEach((c,i)=>{const x=64+i*286;box(s,x,240,258,260,C.white,18,C.line);text(s,c[0],x+22,270,214,46,20,true,C.navy);text(s,c[1],x+22,345,214,90,16,false,C.muted);});
 badge(s,'PRIORIDAD OPERATIVA',64,550,C.aqua,C.blue,200);text(s,'Una parada sin diagnóstico o sin solicitud de repuesto no debe quedar sin seguimiento.',286,556,860,24,18,true,C.ink);}

// 10 parts
{const s=p.slides.add();s.background.fill=C.white;heading(s,'Paso 7','Controla el repuesto desde la necesidad hasta la entrega','El catálogo une familia técnica, área, criticidad, stock, consumo y solicitud.',10);
 const rows=[['Buscar','Código, descripción o ubicación.',C.blue],['Clasificar','Mecánico, eléctrico o electrónico.',C.gold],['Verificar','Confirma stock físico antes de decidir.',C.green],['Solicitar','Área → máquina opcional → repuesto → cantidad.',C.purple]];
 rows.forEach((r,i)=>{const y=235+i*78;box(s,64,y,1080,58,C.pale,14,C.line);box(s,84,y+13,32,32,r[2],10,r[2]);text(s,r[0],136,y+18,190,20,18,true,C.navy);text(s,r[1],372,y+18,690,20,17,false,C.muted);});
 text(s,'El stock se descuenta al confirmar la entrega o salida registrada; no al crear la solicitud.',64,570,1100,26,19,true,C.ink);}

// 11 import / csv
{const s=p.slides.add();s.background.fill=C.pale;heading(s,'Paso 8','Importa Excel de forma segura y exporta lo necesario','La vista previa permite detectar duplicados y errores antes de guardar.',11);
 step(s,1,'Elige catálogo','Áreas, máquinas, repuestos o mantenimientos.',64,242,255,C.blue); step(s,2,'Descarga plantilla','Conserva encabezados y códigos oficiales.',360,242,255,C.gold); step(s,3,'Carga y valida','Revisa crear, actualizar o rechazar.',656,242,255,C.purple); step(s,4,'Procesa','Consulta el historial y descarga CSV.',952,242,255,C.green);
 box(s,138,505,1004,78,C.white,16,C.line);text(s,'Si una importación se realizó por error, el administrador puede eliminarla junto con los datos creados exclusivamente por ese archivo.',168,530,940,26,17,false,C.ink,'center');}

// 12 dashboard action
{const s=p.slides.add();s.background.fill=C.white;heading(s,'Paso 9','Convierte registros en decisiones','Los KPIs y las tarjetas de historial muestran qué tipos de mantenimiento se registran y dónde se requiere atención.',12);
 box(s,64,240,420,312,C.pale,18,C.line);text(s,'Historial por tipo',94,270,240,28,22,true,C.navy);const data=[['Correctivo',791,C.red],['Preventivo',172,C.gold],['Rutinario',89,C.blue],['Otros',96,C.purple]];data.forEach((d,i)=>{const y=328+i*45; text(s,d[0],94,y,150,20,16,false,C.ink);box(s,238,y+4,Math.max(32,d[1]/791*175),16,d[2],8,d[2]);text(s,String(d[1]),404,y,60,20,14,true,C.ink,'right');});
 box(s,536,240,680,312,C.aqua,18,C.aqua);text(s,'Cómo interpretar',568,270,250,28,22,true,C.navy);bullet(s,'Haz clic en una tarjeta para abrir el centro de mantenimiento con el tipo filtrado.',568,328,570,C.blue);bullet(s,'Filtra por día, semana, mes, año o historial completo.',568,384,570,C.gold);bullet(s,'Compara áreas cuando existan registros completos y validados.',568,440,570,C.green);}

// 13 closing checklist
{const s=p.slides.add();s.background.fill=C.navy;text(s,'Al terminar cada actividad, deja el proceso completo',64,76,1080,52,37,true,C.white);text(s,'Una operación bien registrada mejora la continuidad de producción y la calidad de la información.',64,142,1000,32,19,false,'#DDEBFA');
 const checks=['Área y máquina correctas','Evidencia antes y después','Hora de inicio y cierre','Diagnóstico y trabajo realizado','Repuestos usados registrados','Estado final validado'];
 checks.forEach((c,i)=>{const x=64+(i%3)*384;const y=245+Math.floor(i/3)*135;box(s,x,y,348,94,'#173A64',16,'#2B5480');box(s,x+18,y+24,34,34,C.blue,10,C.blue);text(s,'✓',x+18,y+27,34,24,18,true,C.white,'center');text(s,c,x+70,y+31,248,25,18,true,C.white);});
 text(s,'INCAMAT · Reportar · Atender · Controlar · Analizar',64,625,760,22,16,true,'#BFD9F4');page(s,13,'INCAMAT · FIN DEL MANUAL');}

await fs.mkdir(OUTDIR,{recursive:true});
for (let i=0;i<p.slides.items.length;i++) {
  const blob=await p.export({slide:p.slides.items[i],format:'png',scale:1});
  await fs.writeFile(`${OUTDIR}/slide-${String(i+1).padStart(2,'0')}.png`,new Uint8Array(await blob.arrayBuffer()));
}
const deck=await PresentationFile.exportPptx(p); await deck.save(OUT);
console.log(OUT);
