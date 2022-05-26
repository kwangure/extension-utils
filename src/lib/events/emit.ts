function getTabStatuses(tab_ids) {
    return Promise.all(tab_ids
        .map((id) => new Promise((r) => chrome.tabs.get(id, r))));
}

export async function sendMessageToTabs(message: {
    event: string,
    tabs: chrome.tabs.QueryInfo | number[],
    payload: unknown,
}) {
    if (chrome.tabs) {
        let tabs: chrome.tabs.Tab[];

        if (Array.isArray(message.tabs)) {
            tabs = await getTabStatuses(message.tabs);
        } else {
            tabs = await chrome.tabs.query(message.tabs);
        }

        const sendMessagePromises = [];
        for (const { id, status } of tabs) {
            // Ignore tabs in loading status
            if (status !== "complete") break;

            sendMessagePromises.push(chrome.tabs.sendMessage(id, message, {}));
        }

        return Promise.all(sendMessagePromises);
    }
}

export function sendMessageToRuntime(message) {
    // Send messages to other frames e.g extension url, options, popup etc.
    return chrome.runtime.sendMessage(message);
}
