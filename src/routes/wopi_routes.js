const {Router} = require('express')

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



// /files/(file_id) -> CheckFileInfo

class WOPIFileController {


    static async CheckFileInfo(req, res) {
        const file_id = req.params.file_id;
        const wopi_file_service = new WOPIFileService({user_id: req.user_id});
        const check_file_info = await wopi_file_service.CheckFileInfo(file_id);
        return res.json(check_file_info);
    }

    static async GetFile(req, res) {
        const file_id = req.params.file_id;
        const wopi_file_service = new WOPIFileService({user_id: req.user_id});
        const {file_buffer, file_meta} = await wopi_file_service.GetFile(file_id);
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Length', file_meta.size_in_bytes);
        res.setHeader('X-WOPI-ItemVersion', file_meta.version);
        res.send(file_buffer);
    }
}




class WOPIFileService {
    COMMON_CONFIG = {
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


    constructor({user_id,}) {
        this.user_id = user_id;
    }



    async CheckFileInfo(file_id) {
        const file_storage = new FileStorage();
        await file_storage.getFile(file_id);
        const file_meta = await file_storage.getFileMetadata(file_id);
        // todo: db call to get file name, ownerId, userId, userFriendlyName, etc.
        return {
            ...this.COMMON_CONFIG,
            UserId: this.user_id,
            BaseFileName: "file_name.xlsx",
            Size: file_meta.size_in_bytes,
            Version: file_meta.version,
        }
    }


    async GetFile(file_id) {
        const file_storage = new FileStorage();
        const file_buffer =await file_storage.getFile(file_id);
        const file_meta = await file_storage.getFileMetadata(file_id);
        return {
            file_buffer,
            file_meta
        }

    }


}











// class that will wrap file fetching and metadata of that file logic
class FileStorage {

    MetaData = class {
        constructor(version, size_in_bytes) {
            this.version = version;
            this.size_in_bytes = size_in_bytes;
        }
    }

    /**
     * @type {MetaData}
     */
    #file_meta;

    async getFile(file_id) {
        // todo: if a metadata is already fetched, store it
        const file = Buffer.from("A basic file like content");
        this.#file_meta = new this.MetaData("1.0", 1000);
        return file;
    }

    /**
     * Get file metadata
     * @param file_id
     * @returns {Promise<FileStorage.MetaData>}
     */
    async getFileMetadata(file_id) {
        if (this.#file_meta) {
            return this.#file_meta;
        }
        // fetch only meta data.
        return new this.MetaData("1.0", 1000);
    }
}








