const {Router} = require('express')
const {FileManager, DeviceFileStorage} = require("../services/FileStorage");

// access token middleware
// this access_token can be passed by Authorization header or query parameter
// only fallback to query parameter if Authorization header is not present

function AuthMiddleware(req, res, next) {
    const access_token = req.headers.authorization ?
        req.headers.authorization.split(" ")[1] : req.query.access_token;

    if (!access_token) {
        return res.status(401).json({error: "Unauthorized"});
    }
    // todo: add token validation logic here

    next();
}


// /files/(file_id) -> CheckFileInfo

class WOPIFileController {


    static async CheckFileInfo(req, res) {
        const file_id = req.params["file_id"];
        const wopi_file_service = new WOPIFileService({user_id: req.user_id});
        const check_file_info = await wopi_file_service.CheckFileInfo(file_id);
        return res.json(check_file_info);
    }

    static async GetFile(req, res) {
        const file_id = req.params["file_id"];
        const wopi_file_service = new WOPIFileService({user_id: req.user_id});
        const {file_buffer, file_meta} = await wopi_file_service.GetFile(file_id);
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Length', file_meta.size_in_bytes);
        res.setHeader('X-WOPI-ItemVersion', file_meta.version);
        res.send(file_buffer);
    }


    static async PutFile(req, res) {
        const headers = req.headers;
        const file_id = req.params["file_id"];
        const wopi_file_service = new WOPIFileService({user_id: req.user_id});
        const {} = await wopi_file_service.overrideFile(file_id, headers);
    }

    static async OverrideFile(req, res) {
        const headers = req.headers;
        const file_id = req.params["file_id"];
        const file_buffer = req.body;
        const wopi_file_service = new WOPIFileService({user_id: req.user_id});
        const {
            response_headers,
            http_status_code
        } = await wopi_file_service.overrideFile(file_id, headers, file_buffer);
        res.status(http_status_code)
        for (let key in response_headers) {
            res.setHeader(key, response_headers[key]);
        }
        res.send();
    }
}


//  each wopi router must start with /wopi
const router = Router();

router.use(AuthMiddleware);
router.get('/files/:file_id/contents', WOPIFileController.GetFile);
router.get('/files/:file_id', WOPIFileController.CheckFileInfo);
router.post('/files/:file_id', WOPIFileController.OverrideFile);


class WOPIFileService {

    constructor({user_id,}) {
        this.user_id = user_id;
    }


    async CheckFileInfo(file_id) {
        const COMMON_CONFIG = {
            OwnerId: '1audit',
            UserId: 'USER',
            UserFriendlyName: '1AUDIT',

            SupportsLocks: true,
            SupportsGetLock: true,
            SupportsExtendedLockLength: true,

            // use can write to the file
            UserCanWrite: true,
            // use can write relative to the file (save as action)
            UserCanNotWriteRelative: true,

            SupportsUpdate: true,
            SupportsContainers: false,
            SupportsEcosystem: false,
            SupportsRename: false,
            UserCanRename: false,
        };

        const file_storage = new FileManager(new DeviceFileStorage());
        await file_storage.loadFile(file_id);
        const file_meta = await file_storage.getFileMetadata(file_id);
        // todo: db call to get file name, ownerId, userId, userFriendlyName, etc.
        return {
            ...COMMON_CONFIG,
            UserId: this.user_id,
            BaseFileName: "file_name.xlsx",
            Size: file_meta.size_in_bytes,
            Version: file_meta.version,
        }
    }


    async GetFile(file_id) {
        const file_storage = new FileManager(new DeviceFileStorage());
        const file_buffer = await file_storage.loadFile(file_id);
        const file_meta = await file_storage.getFileMetadata(file_id);
        return {
            file_buffer,
            file_meta
        }

    }

    async overrideFile(file_id, headers, file_buffer) {
        const x_wopi_override = headers['X-WOPI-Override'];
        const x_wopi_lock_id = headers['X-WOPI-Lock'];
        // support LOCK, FOR NOW.
        let http_status_code = 200;
        let response_headers = {}

        //  check if the file is locked
        const db_lock_status = await this.#getLockStatus(file_id, x_wopi_lock_id);
        const is_locked = db_lock_status.is_locked; // is file locked?
        const db_lock_id = db_lock_status.lock_id; // current lock id in db

        /** this file isn't locked */

        if (x_wopi_override === "GET_LOCK") {
            // if file is locked then return the lock id
            if (is_locked) {
                // the file is locked
                response_headers = {
                    "X-WOPI-Lock": db_lock_id,
                }
            }
            // if not lock then return empty lock id
            else {
                // the file is unlocked
                response_headers = {
                    "X-WOPI-Lock": "",
                }
            }
        } else if (x_wopi_override === "REFRESH_LOCK") {
            if (!is_locked) {
                // file is not locked so, return empty lock id
                response_headers = {
                    "X-WOPI-Lock": "",
                }
            }
            if (is_locked && db_lock_id !== x_wopi_lock_id) {
                // the file is locked but the lock id is different
                // return the lock id
                response_headers = {
                    "X-WOPI-Lock": db_lock_id,
                }
                http_status_code = 409;
            } else {
                // else, refresh the lock
                await this.RefreshLock(file_id, x_wopi_lock_id);
            }
        } else if (x_wopi_override === "LOCK") {
            // if the file is locked and the lock id is different -
            // return 409 conflict
            if (is_locked && db_lock_id !== x_wopi_lock_id) {
                http_status_code = 409;
                headers = {
                    "X-WOPI-Lock": db_lock_id,
                }
            }
            if (is_locked && db_lock_id === x_wopi_lock_id) {
                // refresh the lock
                await this.RefreshLock(file_id, x_wopi_lock_id);
            } else {
                // lock the file
                await this.Lock(file_id, x_wopi_lock_id);
            }
        } else if (x_wopi_override === "UNLOCK") {

            // if the file is locked and the lock id is different from what is in db
            // and is in header, return conflict 409
            if (is_locked && db_lock_id !== x_wopi_lock_id) {
                http_status_code = 409;
                response_headers = {
                    "X-WOPI-Lock": db_lock_id,
                }
            } else if (is_locked && db_lock_id === x_wopi_lock_id) {
                // unlock the file
                await this.Unlock(file_id);
            }
        } else if (x_wopi_override === "PUT") {
            // if the file is locked and the lock id is different from what is in db
            // and is in header, return conflict 409
            if (is_locked && db_lock_id !== x_wopi_lock_id) {
                http_status_code = 409;
                response_headers = {
                    "X-WOPI-Lock": db_lock_id,
                }
            } else if (is_locked && db_lock_id === x_wopi_lock_id) {
                // put the file
                await this.putFile(file_id, file_buffer);
            }
        }


        return {
            response_headers,
            http_status_code,
        }
    }


    async Lock(file_id, lock_id) {

    }

    async RefreshLock(file_id, lock_id) {

    }

    async Unlock(file_id) {

    }

    async putFile(file_id, file_buffer) {

    }

    async #getLockStatus(file_id, lock_id) {

        return {
            lock_id: "some random lock id",
            is_locked: true,
        }
    }
}




















