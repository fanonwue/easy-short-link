export default interface Repository {

    /**
     * Returns a map that has an alias as it's key, and the full target url as it's value
     */
    getMapping() : Promise<Map<string, string>>;
}