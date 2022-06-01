
export var logger;

if(logger === undefined) {

    logger = {
        log(level, message) {
            console.log(level +':' + message);
        },
        debug(message) {
            console.log('('+Date.now()+') DEBUG: ' + message);
        },
        info(message) {
            console.log(message)
        },
        error(message) {
            console.error(message);
        },
        disable() {
            this.log = () => {};
            this.debug = () => {};
            this.info = () => {};
            this.error = () => {};
        }
    }

}
