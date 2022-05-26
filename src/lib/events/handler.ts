import { sendMessageToRuntime, sendMessageToTabs } from "./emit";
import typeOf from "just-typeof";

export class EventHandler {
    private _onEventListeners: Map<string, Set<() => void>>;
    private _eventHandler: (message, _sender, sendResponseFn) => boolean;

    constructor() {
        this._onEventListeners = new Map();
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const self = this;
        this._eventHandler = (message, _sender, sendResponseFn) => {
            const { event: eventName, payload } = message;
            const eventListeners = self._onEventListeners.get(eventName) || [];

            for (const listener of eventListeners) {
                listener(payload, sendResponseFn);
            }

            return true;
        };

        chrome.runtime.onMessage.addListener(this._eventHandler);
    }
    on(event: string, newListener: () => unknown) {
        const listeners = this._onEventListeners.get(event) || new Set();
        this._onEventListeners.set(event, listeners.add(newListener));

        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const self = this;
        return function unsubscribe() {
            const listeners = self._onEventListeners.get(event);
            listeners.delete(newListener);
        };
    }
    removeListeners() {
        if (chrome.runtime.onMessage.hasListener(this._eventHandler)) {
            chrome.runtime.onMessage.removeListener(this._eventHandler);
        }
    }
    emit({ event, payload = {}, runtime = true, tabs = {}}) {
        if (tabs) {
            sendMessageToTabs({ event, tabs, payload });
        }

        if (runtime) {
            sendMessageToRuntime({ event, payload });
        }
    }
    request(options: string | { query: string, payload: unknown }) {
        let payload = {};
        let event = "";

        if (typeof options === "string") {
            event = options;
        } else if (typeOf(options) === "object") {
            ({ query: event, payload } = options);
        } else {
            throw TypeError("Expected String or Object options.");
        }

        return new Promise((resolve) => {
            chrome.runtime.sendMessage({ event, payload }, (response) => {
                const { lastError } = chrome.runtime;
                if (lastError) {
                    console.error("Unable to respond to request", lastError.message);
                }
                resolve(response);
            });
        });
    }
}
