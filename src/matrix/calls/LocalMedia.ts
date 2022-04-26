/*
Copyright 2022 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import {SDPStreamMetadataPurpose} from "./callEventTypes";
import {Stream} from "../../platform/types/MediaDevices";
import {SDPStreamMetadata} from "./callEventTypes";
import {getStreamVideoTrack, getStreamAudioTrack} from "./common";

export class LocalMedia {
    constructor(
        public readonly userMedia?: Stream,
        public readonly screenShare?: Stream,
        public readonly dataChannelOptions?: RTCDataChannelInit,
    ) {}

    withUserMedia(stream: Stream) {
        return new LocalMedia(stream, this.screenShare, this.dataChannelOptions);
    }

    withScreenShare(stream: Stream) {
        return new LocalMedia(this.userMedia, stream, this.dataChannelOptions);
    }

    withDataChannel(options: RTCDataChannelInit): LocalMedia {
        return new LocalMedia(this.userMedia, this.screenShare, options);
    }

    /** @internal */
    replaceClone(oldClone: LocalMedia | undefined, oldOriginal: LocalMedia | undefined): LocalMedia {
        let userMedia;
        let screenShare;
        const cloneOrAdoptStream = (oldOriginalStream: Stream | undefined, oldCloneStream: Stream | undefined, newStream: Stream | undefined): Stream | undefined => {
            let stream;
            if (oldOriginalStream?.id === newStream?.id) {
                stream = oldCloneStream;
            } else {
                stream = newStream?.clone();
                getStreamAudioTrack(oldCloneStream)?.stop();
                getStreamVideoTrack(oldCloneStream)?.stop();
            }
            return stream;
        }
        return new LocalMedia(
            cloneOrAdoptStream(oldOriginal?.userMedia, oldClone?.userMedia, this.userMedia),
            cloneOrAdoptStream(oldOriginal?.screenShare, oldClone?.screenShare, this.screenShare),
            this.dataChannelOptions
        );
    }

    /** @internal */
    clone(): LocalMedia {
        return new LocalMedia(this.userMedia?.clone(),this.screenShare?.clone(), this.dataChannelOptions);
    }
    
    dispose() {
        this.stopExcept(undefined);
    }

    stopExcept(newMedia: LocalMedia | undefined) {
        if(newMedia?.userMedia?.id !== this.userMedia?.id) {
            getStreamAudioTrack(this.userMedia)?.stop();
            getStreamVideoTrack(this.userMedia)?.stop();
        }
        if(newMedia?.screenShare?.id !== this.screenShare?.id) {
            getStreamVideoTrack(this.screenShare)?.stop();
        }
    }
}
