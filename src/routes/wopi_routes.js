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


//  each wopi router must start with /wopi
const router = Router();

router.use(AuthMiddleware);
router.get('/files/:file_id/contents', WOPIFileController.GetFile);
router.get('/files/:file_id', WOPIFileController.CheckFileInfo);


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
        const {} =await wopi_file_service.overrideFile(file_id, headers);


    }
}




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
        const file_buffer =await file_storage.loadFile(file_id);
        const file_meta = await file_storage.getFileMetadata(file_id);
        return {
            file_buffer,
            file_meta
        }

    }

    async overrideFile(file_id, headers) {
        const x_wopi_override = headers['X-WOPI-Override'];
        const x_wopi_lock = headers['X-WOPI-Lock'];
        // support LOCK, FOR NOW.
        let http_status_code = 200;
        let response_headers = {}

        //  check if the file is locked
        const db_lock_status = await this.#getLockStatus(file_id, x_wopi_lock);
        const is_locked = db_lock_status.is_locked;

        if(is_locked){

        }

        switch (x_wopi_override) {
            case "LOCK":{
                const {has_failed} = await this.Lock(file_id, x_wopi_lock);
            }
        }



        return {
            response_headers,
            http_status_code,
            file: null,
        }
    }


    async Lock(file_id, lock_id) {
        let http_status_code = 200;
        let failure_reason = null;
        let has_failed = false;

        const db_lock_status = await this.#getLockStatus(file_id);
        if(db_lock_status===null){
            // can lock this file
            // insert lock status in db
        }
        else if (db_lock_status.lock_id===lock_id){
            // already locked by this lock_id
            // extend lock by RefreshLock
           await this.RefreshLock(file_id, lock_id);
        }
        else {
            // the file is already locked by another lock_id
            // return 409 conflict
            http_status_code = 409;
            failure_reason = "File is already locked by another user";
            has_failed = true;
        }
        return {
            http_status_code,
            failure_reason,
            has_failed
        }
    }

    async RefreshLock(file_id, lock_id) {

    }

    async Unlock(file_id) {

    }

    async putFile(file_id, file_buffer) {

    }

    async #getLockStatus(file_id, lock_id) {
        // todo: get lock status from db
        // 1. if lock is expired, return { is_locked: false }
        // 2. if given lock_id matches with the lock_id in db, return { is_locked: false }
        return {
            lock_id : "some random lock id",
            is_locked: true,
        }
    }
}




















