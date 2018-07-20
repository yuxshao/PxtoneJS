const Worker = global.Worker || (() => {});

const getId = (() => {
    let id = 0;
    return function getId() {
        return ++id;
    }
})();

async function post_and_get(worker, msg, cb) {
    return new Promise(resolve => {
        worker.addEventListener("message", function onmessage(e) {
            const data = e.data;
            if (msg.sessionId !== data.sessionId) return;
            worker.removeEventListener("message", onmessage);
            resolve(cb(data));
        });
        worker.postMessage(msg);
    });
}

export default function wrapWorker(pxtnDecoder) {
    return function decoder(type, buffer, ch, sps, bps) {
        if (pxtnDecoder instanceof Worker) {
            // worker
            const sessionId = getId();
            let msg = { sessionId, type, buffer, ch, sps, bps };
            post_and_get(pxtnDecoder, msg, function (data) {
                if (type !== "stream")
                    return { buffer: data.buffer, data: data.data, stream: null };
                else {
                    let stream = {
                        next: function (size) {
                            return post_and_get(
                                pxtnDecoder,
                                { sessionId, type: "stream_next", size },
                                (data) => data.streamBuffer
                            );
                        },
                        release: function () {
                            pxtnDecoder.postMessage({ sessionId, type: "stream_release" });
                        }
                    };
                    return { buffer: data.buffer, data: data.data, stream };
                }
            });

            pxtnDecoder.postMessage({
                sessionId,
                type,
                buffer,
                ch,
                sps,
                bps
            });
        } else {
            // function
            return pxtnDecoder(type, buffer, ch, sps, bps);
        }
    };
}
