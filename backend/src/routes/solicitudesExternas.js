const express = require("express"); const pool = require("../../config/database"); const router = express.Router();
router.get("/", async (_req,res)=>{let conn;try{conn=await pool.getConnection();res.json(await conn.query("SELECT s.*,a.nombre AS area FROM solicitudes_externas s LEFT JOIN areas a ON a.id=s.id_area ORDER BY s.fecha_reporte DESC"));}catch(e){res.status(500).json({error:"No fue posible obtener solicitudes externas."});}finally{if(conn)conn.release();}});
module.exports=router;
