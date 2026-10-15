import assert from 'node:assert/strict';
import {
    normalizeMimeType, normalizeFileType, getFileExtension, inferFileType,
    resolveFileType, resolveFileExt, isExtValid, matchesFileType, getFileTypeCategory,
} from '../functions/utils/mimeTypes.js';

describe('file types and extensions', () => {
    it('compares MIME essence and preserves case-sensitive Content-Type parameters', () => {
        const type = ' Multipart/Mixed ; boundary=AbC123; charset=UTF-8 ';
        assert.equal(normalizeMimeType(type), 'multipart/mixed');
        assert.equal(normalizeFileType(type), 'multipart/mixed; boundary=AbC123; charset=UTF-8');
        assert.equal(resolveFileType('photo.jpg', type), 'multipart/mixed; boundary=AbC123; charset=UTF-8');
    });

    for (const generic of ['', null, undefined, 'application/octet-stream', 'binary/octet-stream', 'application/octet-stream; charset=binary', ' BINARY/OCTET-STREAM ; name=File ']) {
        it(`infers only when MIME is empty or generic: ${JSON.stringify(generic)}`, () => {
            assert.equal(resolveFileType('folder/photo.WEBP', generic), 'image/webp');
            assert.equal(matchesFileType(generic, 'folder/photo.WEBP', ['image']), true);
        });
    }

    it('preserves explicit MIME even when the filename disagrees', () => {
        assert.equal(resolveFileType('photo.jpg', 'application/pdf; name=Photo'), 'application/pdf; name=Photo');
        assert.equal(matchesFileType('application/pdf', 'photo.jpg', ['image']), false);
        assert.equal(matchesFileType('application/pdf', 'photo.jpg', ['pdf']), true);
        assert.equal(matchesFileType('application/pdf; name=image.png', 'photo.jpg', ['image']), false);
        assert.equal(matchesFileType('application/octet-stream; name=image.png', 'photo.bin', ['image']), false);
    });

    it('supports common media/documents and leaves ambiguous/unknown suffixes generic', () => {
        for (const [name, type] of [['a.bmp', 'image/bmp'], ['a.ico', 'image/x-icon'], ['a.mp4', 'video/mp4'], ['a.mp3', 'audio/mpeg'], ['a.pdf', 'application/pdf']]) {
            assert.equal(inferFileType(name), type);
            assert.equal(resolveFileType(name, ''), type);
        }
        for (const name of ['a.unknown', 'README', 'a.ts']) assert.equal(resolveFileType(name, ''), 'application/octet-stream');
    });

    it('preserves the content= escape hatch for missing MIME and unknown extensions', () => {
        for (const type of ['', null, undefined, 'application/octet-stream', 'application/pdf']) {
            assert.equal(matchesFileType(type, 'notes.unknown', ['']), true);
            assert.equal(matchesFileType(type, 'notes.unknown', ['image', '']), true);
        }
        assert.equal(matchesFileType('', 'notes.unknown', []), false);
    });

    it('keeps random keyword matching and strict management categories distinct', () => {
        assert.equal(matchesFileType('application/x-image', 'file.bin', ['image']), true);
        assert.equal(getFileTypeCategory('application/x-image'), 'other');
        assert.equal(getFileTypeCategory(' IMAGE/PNG; name=Test '), 'image');
        assert.equal(getFileTypeCategory('video/mp4'), 'video');
        assert.equal(getFileTypeCategory('audio/mpeg'), 'audio');
        assert.equal(getFileTypeCategory('application/octet-stream'), 'other');
        assert.equal(matchesFileType('image/png', 'file.png', ['video', 'image']), true);
    });

    it('extracts basename extensions without borrowing a directory suffix', () => {
        assert.equal(getFileExtension('folder.jpg/README'), '');
        assert.equal(getFileExtension('folder.jpg\\README'), '');
        assert.equal(getFileExtension('folder/photo.PNG'), 'png');
        assert.equal(getFileExtension(null), '');
    });

    it('retains valid filename suffixes and creates usable suffixes from parameterized MIME', () => {
        assert.equal(resolveFileExt('photo.jpg', 'image/png'), 'jpg');
        assert.equal(resolveFileExt('photo.JPG', 'image/png'), 'jpg');
        assert.equal(resolveFileExt('README', 'image/jpeg'), 'jpeg');
        assert.equal(resolveFileExt('README', 'image/svg+xml; charset=UTF-8'), 'svg');
        assert.equal(resolveFileExt('README', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'), 'docx');
        assert.equal(resolveFileExt('README', 'application/octet-stream'), 'bin');
        for (const extension of ['ts', 'psm1', 'qcow2', 'b5t', 'sdi']) assert.equal(isExtValid(extension), true);
    });
});
