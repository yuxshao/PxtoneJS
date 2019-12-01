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
            // (byteLength -> pcm) stream into (numSamples -> audio) stream

            // At some point this was (seconds -> audio), but that isn't really
            // a promise we can keep because (seconds * sps) might not be an
            // integer, so the returned audio buffer would not be the right
            // length.
            let byteStreamNext = decoded.stream.next;
            decoded.stream.next = async function (numSamples) {
                if (!Number.isInteger(numSamples))
                    throw "Warning: trying to get non-integer number of samples " + numSamples;
                let bytesPerSample = bps / 8; // bits per sample / 8
                let size = numSamples * ch * bytesPerSample;
                let buffer = await byteStreamNext(size);
                return decodeAudio(ctx, buffer, ch, sps, bps);
            };

            let auxReset = decoded.stream.reset;
            decoded.stream.reset = function (pos) {
                if (!Number.isInteger(pos))
                    throw "Bug: trying to seek to non-integer sample position " + pos;
                return auxReset(pos);
            }

            decoded.stream.getSps = function () { return sps; }
        }
        else
            decoded.buffer = await decodeAudio(ctx, decoded.buffer, ch, sps, bps);

        return decoded;
    };

}
