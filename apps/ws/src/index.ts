import { WebSocketServer } from "ws";
import { GameManager } from "./GameManager.js";
import { extractUserId } from "./auth/index.js";
import { User } from "./SocketManager.js";
import { getRedis } from "./redis.js";

const wss = new WebSocketServer({ port: 8080 });
getRedis();

const gameManager = new GameManager();
console.log("WS server listening on :8080");

wss.on("connection", (ws, req) => {
    // Without this, any protocol error on the socket throws and kills the process
    ws.on("error", (err) => console.error("Socket error:", err.message));

    const token = new URL(req.url ?? "/", "http://localhost").searchParams.get("token");
    const userId = extractUserId(token);

    if (!userId) {
        ws.close(1008, "Unauthorized");   // 1008 = policy violation
        return;
    }

    const user = new User(ws, userId);
    gameManager.addUser(user);

    ws.on("close", () => gameManager.removeUser(user));   // pass the User, not the account id
});