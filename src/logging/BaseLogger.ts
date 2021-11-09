/*
Copyright 2020 Bruno Windels <bruno@windels.cloud>
Copyright 2021 The Matrix.org Foundation C.I.C.

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

import {LogItem, LabelOrValues, FilterCreator} from "./LogItem";
import {LogLevel, LogFilter} from "./LogFilter.js";
import {Platform} from "../platform/web/Platform.js";

type LogCallback = (item: LogItem) => Promise<unknown> | undefined;

export abstract class BaseLogger {
    protected _openItems: Set<LogItem> = new Set();
    protected _platform: Platform;

    constructor({platform}) {
        this._platform = platform;
    }

    log(labelOrValues: LabelOrValues, logLevel: number = LogLevel.Info) {
        const item = new LogItem(labelOrValues, logLevel, null, this);
        item.end = item.start;
        this._persistItem(item, null, false);
    }

    /** if item is a log item, wrap the callback in a child of it, otherwise start a new root log item. */
    wrapOrRun(item: LogItem, labelOrValues: LabelOrValues, callback: LogCallback, logLevel: LogLevel = null, filterCreator: FilterCreator = null) {
        if (item) {
            return item.wrap(labelOrValues, callback, logLevel, filterCreator);
        } else {
            return this.run(labelOrValues, callback, logLevel, filterCreator);
        }
    }

    /** run a callback in detached mode,
    where the (async) result or errors are not propagated but still logged.
    Useful to pair with LogItem.refDetached.

    @return {LogItem} the log item added, useful to pass to LogItem.refDetached */
    runDetached(labelOrValues: LabelOrValues, callback: LogCallback, logLevel: LogLevel = null, filterCreator: FilterCreator = null) {
        if (logLevel === null) {
            logLevel = LogLevel.Info;
        }
        const item = new LogItem(labelOrValues, logLevel, null, this);
        this._run(item, callback, logLevel!, filterCreator, false /* don't throw, nobody is awaiting */);
        return item;
    }

    /** run a callback wrapped in a log operation.
    Errors and duration are transparently logged, also for async operations.
    Whatever the callback returns is returned here. */
    run(labelOrValues: LabelOrValues, callback: LogCallback, logLevel: LogLevel = null, filterCreator: FilterCreator = null) {
        if (logLevel === null) {
            logLevel = LogLevel.Info;
        }
        const item = new LogItem(labelOrValues, logLevel, null, this);
        return this._run(item, callback, logLevel!, filterCreator, true);
    }

    _run(item: LogItem, callback: LogCallback, logLevel: number, filterCreator: FilterCreator, shouldThrow: boolean) {
        this._openItems.add(item);

        const finishItem = () => {
            let filter = new LogFilter();
            if (filterCreator) {
                try {
                    filter = filterCreator(filter, item);
                } catch (err) {
                    console.error("Error while creating log filter", err);
                }
            } else {
                // if not filter is specified, filter out anything lower than the initial log level
                filter = filter.minLevel(logLevel);
            }
            try {
                this._persistItem(item, filter, false);
            } catch (err) {
                console.error("Could not persist log item", err);
            }
            this._openItems.delete(item);
        };

        try {
            const result = item.run(callback);
            if (result instanceof Promise) {
                return result.then(promiseResult => {
                    finishItem();
                    return promiseResult;
                }, err => {
                    finishItem();
                    if (shouldThrow) {
                        throw err;
                    }
                });
            } else {
                finishItem();
                return result;
            }
        } catch (err) {
            finishItem();
            if (shouldThrow) {
                throw err;
            }
        }
    }

    _finishOpenItems() {
        for (const openItem of this._openItems) {
            openItem.finish();
            try {
                // for now, serialize with an all-permitting filter
                // as the createFilter function would get a distorted image anyway
                // about the duration of the item, etc ...
                // true for force finish
                this._persistItem(openItem, new LogFilter(), true);
            } catch (err) {
                console.error("Could not serialize log item", err);
            }
        }
        this._openItems.clear();
    }

    abstract _persistItem(item: LogItem, filter?: LogFilter, forced?: boolean): void;

    abstract export(): void;

    // expose log level without needing 
    get level() {
        return LogLevel;
    }

    _now(): number {
        return this._platform.clock.now();
    }

    _createRefId() {
        return Math.round(this._platform.random() * Number.MAX_SAFE_INTEGER);
    }
}
