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
            return post_and_get(pxtnDecoder, msg, function (data) {
                data.stream = null;
                if (type === "stream")
                    data.stream = {
                        next: function (size) {
                            return post_and_get(
                                pxtnDecoder,
                                { sessionId, type: "stream_next", size },
                                data => data.streamBuffer
                            );
                        },
                        release: function () {
                            pxtnDecoder.postMessage({ sessionId, type: "stream_release" });
                        },
                        reset: function (position) {
                            pxtnDecoder.postMessage({ sessionId, type: "stream_reset", position, });
                        },
                        setMute: function (unitNum, isMute) {
                            pxtnDecoder.postMessage({ sessionId, type:
                              "stream_set_mute", unitNum, isMute});
                        },
                        getMute: function (unitNum) {
                            pxtnDecoder.postMessage({ sessionId, type:
                              "stream_get_mute", unitNum});
                        }
                    };
                return data;
            });
        } else {
            // function
            return pxtnDecoder(type, buffer, ch, sps, bps);
        }
    };
}
