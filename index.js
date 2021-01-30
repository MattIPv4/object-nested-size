const v8 = require('v8');

// Thanks to https://github.com/miktam/sizeof for the basis of this

const getSize = (object, seen, id) => {
    const objectType = typeof object;

    // Primitives
    if (['undefined', 'string', 'boolean', 'number', 'bigint'].includes(objectType)) {
        return {
            id,
            type: objectType,
            size: v8.serialize(object).byteLength,
        };
    }

    // Null
    if (object === null) {
        return {
            id,
            type: 'null',
            size: 0,
        };
    }

    // Symbol
    if (objectType === 'symbol') {
        return {
            id,
            type: 'symbol',
            size: Symbol.keyFor && Symbol.keyFor(object)
                ? v8.serialize(Symbol.keyFor(object)).byteLength
                : v8.serialize(object.toString()).byteLength,
        };
    }

    // Buffer
    if (Buffer.isBuffer(object)) {
        return {
            id,
            type: 'buffer',
            size: object.byteLength,
        };
    }

    // Array
    if (Array.isArray(object)) {
        const res = object.map((innerObject, i) => getSize(innerObject, seen, `${id}[${i}]`));
        return {
            id,
            type: 'array',
            size: res.reduce((acc, item) => acc + item.size, 0),
            values: res,
        };
    }

    // Object
    if (objectType === 'object') {
        // Handle circular objects
        const circularId = seen.get(object);
        if (circularId !== undefined) {
            return {
                id,
                circularId,
                type: 'circular',
                size: 0,
            };
        }
        seen.set(object, id);

        // Get props
        const props = [];
        for (const prop in object) props.push(prop);
        if (Object.getOwnPropertySymbols) Array.prototype.push.apply(props, Object.getOwnPropertySymbols(object));

        // Get the sizes
        const res = props.reduce((all, prop) => {
            const propId = `${id}.${prop.toString()}`;
            const keySize = getSize(prop, seen, `${propId}\{key\}`);
            const valueSize = getSize(object[prop], seen, propId);
            all[prop] = {
                key: keySize,
                value: valueSize,
                size: keySize.size + valueSize.size,
            };
            return all;
        }, {});

        // Wrap
        return {
            id,
            type: 'object',
            size: Object.values(res).reduce((acc, item) => acc + item.size, 0),
            values: res,
        };
    }

    // Unknown (functions)
    return {
        id,
        type: 'unknown',
        typeof: objectType,
        size: 0,
    };
};

module.exports = object => getSize(object, new WeakMap(), '{root}');
