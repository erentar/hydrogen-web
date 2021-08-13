/*
Copyright 2020 Bruno Windels <bruno@windels.cloud>

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

import {Transaction} from "./Transaction";
import { STORE_NAMES, StorageError } from "../common";
import { reqAsPromise } from "./utils";

const WEBKITEARLYCLOSETXNBUG_BOGUS_KEY = "782rh281re38-boguskey";

export class Storage {
    private _db: IDBDatabase;
    private _hasWebkitEarlyCloseTxnBug: boolean;
    storeNames: { [ name : string] : string };

    constructor(idbDatabase: IDBDatabase, IDBKeyRange, hasWebkitEarlyCloseTxnBug: boolean) {
        this._db = idbDatabase;
        // @ts-ignore
        this._IDBKeyRange = IDBKeyRange;
        this._hasWebkitEarlyCloseTxnBug = hasWebkitEarlyCloseTxnBug;
        const nameMap = STORE_NAMES.reduce((nameMap, name) => {
            nameMap[name] = name;
            return nameMap;
        }, {});
        this.storeNames = Object.freeze(nameMap);
    }

    _validateStoreNames(storeNames: string[]): void {
        const idx = storeNames.findIndex(name => !STORE_NAMES.includes(name));
        if (idx !== -1) {
            throw new StorageError(`Tried top, a transaction unknown store ${storeNames[idx]}`);
        }
    }

    async readTxn(storeNames: string[]): Promise<Transaction> {
        this._validateStoreNames(storeNames);
        try {
            const txn = this._db.transaction(storeNames, "readonly");
            // https://bugs.webkit.org/show_bug.cgi?id=222746 workaround,
            // await a bogus idb request on the new txn so it doesn't close early if we await a microtask first
            if (this._hasWebkitEarlyCloseTxnBug) {
                await reqAsPromise(txn.objectStore(storeNames[0]).get(WEBKITEARLYCLOSETXNBUG_BOGUS_KEY));
            }
            // @ts-ignore
            return new Transaction(txn, storeNames, this._IDBKeyRange);
        } catch(err) {
            throw new StorageError("readTxn failed", err);
        }
    }

    async readWriteTxn(storeNames: string[]): Promise<Transaction> {
        this._validateStoreNames(storeNames);
        try {
            const txn = this._db.transaction(storeNames, "readwrite");
            // https://bugs.webkit.org/show_bug.cgi?id=222746 workaround,
            // await a bogus idb request on the new txn so it doesn't close early if we await a microtask first
            if (this._hasWebkitEarlyCloseTxnBug) {
                await reqAsPromise(txn.objectStore(storeNames[0]).get(WEBKITEARLYCLOSETXNBUG_BOGUS_KEY));
            }
            // @ts-ignore
            return new Transaction(txn, storeNames, this._IDBKeyRange);
        } catch(err) {
            throw new StorageError("readWriteTxn failed", err);
        }
    }

    close(): void {
        this._db.close();
    }
}
