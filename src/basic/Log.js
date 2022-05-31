
export var logger;

if(logger === undefined) {

    logger = {
        log(level, message) {
            console.log(level +':' + message);
        },
        info(message) {
            console.log(message)
        },
        error(message) {
            console.error(message);
        }
    }

}
