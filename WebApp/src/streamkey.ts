let streamkeys : string = "";

export function setStreamkeys(keys: string) {
    streamkeys = keys;
}

export function getStreamkeys() : string[] {
    return streamkeys.split(',');
}
