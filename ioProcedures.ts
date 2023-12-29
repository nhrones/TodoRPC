
import { join, walkSync,  } from "./deps.ts";
import type { WalkEntry } from "./deps.ts";


/** Get folder contents */
export const getFolderContent = (path: string) => {
    const paths: WalkEntry[] = []
    const entires = walkSync(path, {
        includeFiles: true,
        includeDirs: true,
        followSymlinks: false,
    });
    
    for (const entry of entires) {
        paths.push(entry)
    }
    return paths
}


/** 
 * Save file content 
 */
export const saveFile = (folder: string, fileName: string, content: string): Promise<void> => {
    return Deno.writeTextFile(join(folder, fileName), content);
}

/**
 * Get file content 
 */
export const getFile = async (folder: string, fileName: string): Promise<string> => {
    return await Deno.readTextFile(join(folder, fileName));
}