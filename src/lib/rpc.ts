import { dequal } from "dequal/lite";

const CLIENT_STORAGE = "rpc-client-storage";

/* The extension context initiating/receiving RPC requests */
export type Target = "background" | "content" | "devtools" | "newtab" | "popup" |"route";

type ClientMeta = {
    extensionId: typeof chrome.runtime.id,
    origin: typeof location.origin,
    tab: chrome.tabs.Tab,
    url: typeof location.href,
}

type ClientStorage = {
    [target in Target]: {
        functions: Record<string, number>,
        clients: ClientMeta[],
    }
}

export class RPC {
    private _clientMeta = null;
    private _closed: boolean;
    /* eslint-disable-next-line */
    private _functions: Record<string, Function>;
    private _targetName: string;

    constructor(
        rpcTarget: Target,
        /* eslint-disable-next-line */
        rpcFuncs: Record<string, Function>
    ) {
        this._targetName = rpcTarget;
        this._functions = rpcFuncs;
        this._closed = false;
        this._clientMeta = null;

        const clientStorage = this._getClientStorage();

        let target = clientStorage[rpcTarget];
        if (!clientStorage[rpcTarget]) {
            target = { functions: {}, clients: [] };
            clientStorage[rpcTarget] = target;
        }

        const { clients, functions } = target;
        for (const func in rpcFuncs) {
            if (Object.hasOwnProperty.call(rpcFuncs, func)) {
                functions[func] = rpcFuncs[func].length;
            }
        }

        chrome.tabs.getCurrent((tab) => {
            this._clientMeta = {
                extensionId: chrome.runtime.id,
                origin: location?.origin,
                tab,
                url: location?.href,
            };
            const thisClient = clients.find((client) => dequal(client, this._clientMeta));
            if (!thisClient) {
                clients.push(this._clientMeta);
            }

            this._setClientStorage(clientStorage);
        });

        chrome.runtime.onMessage.addListener(this._messageListener);
    }
    _getClientStorage() {
        let storageValue = JSON.parse(localStorage.getItem(CLIENT_STORAGE));
        if (!storageValue) {
            storageValue = {} ;
            localStorage.setItem(CLIENT_STORAGE, JSON.stringify(storageValue));
        }

        return storageValue as ClientStorage;
    }
    _setClientStorage(value: ClientStorage) {
        return localStorage.setItem(CLIENT_STORAGE, JSON.stringify(value));
    }
    _messageListener(message, _sender, sendResponseFn) {
        if (!message.isRpc) return;

        const { target, context, func, args } = message;
        if (target !== this._targetName) return;

        const response = {};
        const _func = this._functions[func];
        if (_func) {
            try {
                Object.assign(response, { value: _func.apply(context, args) });
            } catch (error) {
                // Serialize error stack, message etc.
                Object.assign(response, {
                    error: JSON.stringify(error, Object.getOwnPropertyNames(error)),
                });
            }
        } else {
            const error = new Error(`Unknown function name '${func}'.`);
            Object.assign(response, {
                error: JSON.stringify(error, Object.getOwnPropertyNames(error)),
            });
        }

        sendResponseFn(response);

        return true;
    }
    createTarget(target: string) {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const self = this;
        return new Proxy(Object.create(null), {
            get(_, func) {
                if (typeof func !== "string") return;

                return Object.defineProperty(function (...args) {
                    return new Promise((resolve, reject) => {
                        // Don't check until function is called.
                        // Viable RPC targets could be registered between dereference and func call
                        const clientStorage = self._getClientStorage();
                        const _rpcTarget = clientStorage[target];
                        if (!_rpcTarget) {
                            reject(new Error(`Unknown RPC target '${target}'.`));
                        }
                        if (!Object.hasOwnProperty.call(_rpcTarget.functions, func)) {
                            console.error("Available methods", { functions: _rpcTarget })
                            return reject(new Error(`RPC target '${target}' does not have function '${func}'.`));
                        }
                        const message = { args, func, isRpc: true, target };
                        chrome.runtime.sendMessage(message, (response) => {
                            const { lastError } = chrome.runtime;
                            if (lastError) {
                                if (response) console.error("Received response", response);
                                return reject(new Error("Unable to respond to request. " + lastError.message));
                            }

                            if (response.error) {
                                const error = new Error();
                                Object.assign(error, JSON.parse(response.error));
                                return reject(error);
                            }

                            resolve(response.value);
                        });
                    });
                }, "name", { value: func })
            },
        });
    }
    close() {
        if (this._closed) return;

        const clientStorage = this._getClientStorage();
        const { clients } = clientStorage[this._targetName];

        const thisClient = clients.findIndex((client) => dequal(client, this._clientMeta));
        if (thisClient >= 0) {
            clients.splice(thisClient, 1);
            // Unregister functions if this is the last client matching signature
            if (!clients.length) {
                delete clientStorage[this._targetName];
            }
        }

        chrome.runtime.onMessage.removeListener(this._messageListener);
        this._closed = true;
    }
}