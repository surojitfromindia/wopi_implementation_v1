
// class that will wrap file fetching and metadata of that file logic
class FileManager {
    /**
     * @param {FileStorage} storageService
     */
    constructor(storageService) {
        this.storageService = storageService;
    }

    async loadFile(file_id) {
        return await this.storageService.loadFile(file_id);
    }

    /**
     * Get file metadata
     * @param file_id
     * @returns {Promise<FileStorage.MetaData>}
     */
    async getFileMetadata(file_id) {
        return await this.storageService.getFileMetadata(file_id);
    }
}


// this is the abstract class that will be implemented by the actual file storage service
class FileStorage {
    MetaData = class {
        constructor(version, size_in_bytes) {
            this.version = version;
            this.size_in_bytes = size_in_bytes;
        }
    }


    /**
     * Load file content
     * @param file_id
     * @return {Promise<Buffer>}
     */
    async loadFile(file_id) {
        throw new Error("abstract method");
    }

    /**
     * Get file metadata
     * @param file_id
     * @return {Promise<MetaData>}
     */
    async getFileMetadata(file_id) {
        throw new Error("abstract method");
    }
}

class DeviceFileStorage extends FileStorage {
    /**
     * @type {FileManager.MetaData}
     */
    #file_meta;
    constructor() {
        super();
    }

    async loadFile(file_id) {
        // todo: if a metadata is already fetched, store it
        const file = Buffer.from("A basic file like content");
        this.#file_meta = new this.MetaData("1.0", 1000);
        return file;
    }

    async getFileMetadata(file_id) {
        if (this.#file_meta) {
            return this.#file_meta;
        }
        // fetch only meta data.
        return new this.MetaData("1.0", 1000);
    }
}



module.exports = {
    FileManager,
    DeviceFileStorage
}