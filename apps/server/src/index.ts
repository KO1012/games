import { WebSocketTransport } from "@colyseus/ws-transport";
import { DEFAULT_SERVER_PORT, ROOM_NAME } from "@coop-game/shared";
import { defineRoom, defineServer } from "colyseus";

import { CoopRoom } from "./rooms/CoopRoom.js";

const port = Number.parseInt(process.env.PORT ?? `${DEFAULT_SERVER_PORT}`, 10);

const server = defineServer({
  transport: new WebSocketTransport({
    pingInterval: 3000,
    pingMaxRetries: 2,
  }),
  rooms: {
    [ROOM_NAME]: defineRoom(CoopRoom),
  },
});

await server.listen(port);

console.log(`Colyseus server listening on http://localhost:${port}`);
console.log(`Room type registered: ${ROOM_NAME}`);

