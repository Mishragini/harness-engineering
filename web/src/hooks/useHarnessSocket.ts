import { useCallback, useEffect, useRef, useState } from "react";
import type { AgentEvent, ClientMessage } from "@shared/event";

const WS_URL = `ws://${location.hostname}:8787/ws`;

export function useHarnessSocket() {
    const socketRef = useRef<WebSocket | null>(null);
    const [connected, setConnected] = useState(false);
    const [events, setEvents] = useState<AgentEvent[]>([]);

    useEffect(() => {
        const socket = new WebSocket(WS_URL);
        socketRef.current = socket;

        socket.onopen = () => setConnected(true);
        socket.onclose = () => setConnected(false);

        socket.onmessage = (e) => {
            const event = JSON.parse(e.data);
            setEvents((prev) => [...prev, event]);
        };

        return () => socket.close();
    }, []);

    const send = useCallback((message: ClientMessage) => {
        socketRef.current?.send(JSON.stringify(message));
    }, []);

    return { connected, events, send }
}