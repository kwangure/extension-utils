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

        for (const { id, status, url } of tabs) {
            // Ignore tabs in loading status
            if (status !== "complete") break;

            chrome.tabs.sendMessage(id, message, {}, () => {
                const { lastError } = chrome.runtime;
                if (lastError) {
                    console.error(`Unable to send message to tab (url: ${url}, id: ${id}, status: ${status}).`, lastError.message);
                }
            });
        }
    }
}

export function sendMessageToRuntime(message) {
    // Send messages to other frames e.g extension url, options, popup etc.
    chrome.runtime.sendMessage(message, () => {
        const { lastError } = chrome.runtime;
        if (lastError) {
            console.error("Unable to send message to runtime.", lastError.message);
        }
    });
}
