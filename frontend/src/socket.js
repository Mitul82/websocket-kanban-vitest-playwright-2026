import { io } from "socket.io-client";

// Single socket instance for the client. Change URL via env if needed.
const BACKEND = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

const socket = io(BACKEND, { autoConnect: true });

// Expose a short-lived flag for E2E tests to know when the socket is connected.
if (typeof window !== 'undefined') {
	window.__socketConnected = false;
	socket.on('connect', () => {
		window.__socketConnected = true;
	});
	socket.on('disconnect', () => {
		window.__socketConnected = false;
	});
}

export default socket;
