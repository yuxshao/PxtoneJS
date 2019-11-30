import { checkArguments, getAptSampleRate } from "./value";
import { decodeAudio } from "./buffer";
import wrapWorker from "./wrapWorker";


export default function createDecoder(pxtnDecoder) {

    const decoder = wrapWorker(pxtnDecoder);

    return async function decode(ctx, type, buffer, ch = 2, sps = null, bps = 16) {
        // check arguments
        checkArguments(ctx, type, buffer, ch, sps, bps);

        // set SampleRate
        if (sps === null) {
            sps = getAptSampleRate(ctx);
        }

        let ret;
        let retData = null;

        // pxtone, noise
        let decoded = await decoder(type, buffer, ch, sps, bps);

        // byteLength shouldn't be exposed to user
        if (decoded.data) delete decoded.data.byteLength;

        let audioBuffer = null;
        let audioStream = null;
        if (decoded.stream) {
            // (byteLength -> pcm) stream into (duration -> audio) stream
            let byteStreamNext = decoded.stream.next;
            decoded.stream.next = async function (duration) {
                let bytesPerSample = bps / 8; // bits per sample / 8
                let size = duration * ch * bytesPerSample * sps;
                let buffer = await byteStreamNext(size);
                return decodeAudio(ctx, buffer, ch, sps, bps);
            };

            // seek by second instead of by sample num
            let byteReset = decoded.stream.reset;
            decoded.stream.reset = function (seek_seconds) {
                let position = seek_seconds * sps;
                return byteReset(position);
            }
        }
        else
            decoded.buffer = await decodeAudio(ctx, decoded.buffer, ch, sps, bps);

        return decoded;
    };

}
