import Settings from "./settings.model.js"

class SettingsService{

    
    /**
     * 
     * @returns {Promise{Object}} Returns an object
     */
    async getSettings(){
        const settings = Settings.findOne()
        return settings;
    }
}

export default new SettingsService()