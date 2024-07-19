var assert = require('assert');
describe('Load Image API Endpoint', function () {
    describe('/files', function () {
        it('should load the images without error', async function () {
            //Get http://localhost:8080/file/f0af45d69a7160e4af998.png
            const response = await fetch("http://localhost:8080/file/f0af45d69a7160e4af998.png");
            //Check if the status code is 200
            assert.equal(response.status, 200);
        });
    });
});