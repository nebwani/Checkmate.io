import { useEffect, useState } from "react";
import { useUser } from "../store/src/hooks/useUser";

const WS_URL = import.meta.env.VITE_WS_URL;

export const useSocket = () => {
    const [socket, setSocket] = useState<WebSocket | null>(null);
    const user = useUser();

    useEffect(() => {
        const token = user?.token;
        if (!token) return;                   // never connect with "token=undefined"

        let cancelled = false;                // set by cleanup: a close we asked for must not reconnect
        let retry = 0;
        let timer: ReturnType<typeof setTimeout> | undefined;
        let ws: WebSocket | null = null;

        const connect = () => {
            const sock = new WebSocket(`${WS_URL}?token=${encodeURIComponent(token)}`);
            ws = sock;

            sock.onopen = () => {
                retry = 0;
                setSocket(sock);
            };
            sock.onerror = (e) => console.log(e);
            sock.onclose = (e) => {
                setSocket(s => (s === sock ? null : s));   // don't clobber a newer socket
                if (cancelled || e.code === 1008) return;  // our own cleanup, or the server rejected the token
                timer = setTimeout(connect, Math.min(1000 * 2 ** retry++, 10000));   // 1s, 2s, 4s... max 10s
            };
        };

        connect();

        return () => {
            cancelled = true;
            clearTimeout(timer);
            ws?.close();
        };
    }, [user]);

    return socket;
};