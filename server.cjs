const { createApp } = require("./app.cjs");
const { migrate } = require("./migrate.cjs");

const port = process.env.PORT || 4173;

migrate()
  .then(() => {
    createApp().listen(port, () => {
      console.log(`L'Héritage des Mornes — server listening on port ${port}`);
    });
  })
  .catch((err) => {
    console.error("[migrate] échec de la migration de la base:", err);
    process.exit(1);
  });
