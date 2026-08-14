const app = require("./src/app");

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log("=================================");
    console.log("🚀 INCAMAT API");
    console.log("=================================");
    console.log(`Servidor iniciado en el puerto ${PORT}`);
});