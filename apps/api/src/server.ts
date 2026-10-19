import { loadEnv } from "./env.js";
import { buildApp } from "./app.js";

const env = loadEnv();
const app = buildApp(env);

app.listen({ port: env.PORT, host: "0.0.0.0" }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
