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
                let size = duration * ch * (bps / 8) * sps;
                let buffer = await byteStreamNext(size);
                return decodeAudio(ctx, buffer, ch, sps, bps);
            };
        }
        else
            decoded.buffer = await decodeAudio(ctx, decoded.buffer, ch, sps, bps);

        return decoded;
    };

}
