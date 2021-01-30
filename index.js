const v8 = require('v8');

// Thanks to https://github.com/miktam/sizeof for the basis of a lot of this

const getSize = (object, seen, id, itemTransform, unknownHandler) => {
    const objectType = typeof object;

    // Primitives
    if (['undefined', 'string', 'boolean', 'number', 'bigint'].includes(objectType)) {
        return itemTransform({
            id,
            type: objectType,
            size: v8.serialize(object).byteLength,
        });
    }

    // Symbol
    if (objectType === 'symbol') {
        return itemTransform({
            id,
            type: 'symbol',
            size: Symbol.keyFor && Symbol.keyFor(object)
                ? v8.serialize(Symbol.keyFor(object)).byteLength
                : v8.serialize(object.toString()).byteLength,
        });
    }

    // Object
    if (objectType === 'object') {
        // Null
        if (object === null) {
            return itemTransform({
                id,
                type: 'null',
                size: 0,
            });
        }

        // Handle circular objects
        const circularId = seen.get(object);
        if (circularId !== undefined) {
            return itemTransform({
                id,
                circularId,
                type: 'circular',
                size: 0,
            });
        }
        seen.set(object, id);

        // Buffer
        if (Buffer.isBuffer(object)) {
            return itemTransform({
                id,
                type: 'buffer',
                size: object.byteLength,
            });
        }

        // Array
        if (Array.isArray(object)) {
            const res = object.map((innerObject, i) =>
                getSize(innerObject, seen, `${id}[${i}]`, itemTransform, unknownHandler));
            return itemTransform({
                id,
                type: 'array',
                size: res.reduce((acc, item) => acc + item.size, 0),
                values: res.sort((a, b) => b.size - a.size),
            });
        }

        // Map & WeakMap
        if (object instanceof Map || object instanceof WeakMap) {
            const res = [...object.keys()].map(key => {
                const keyId = `${id}.${key.toString()}`;
                const keySize = getSize(key, seen, `${keyId}\{key\}`, itemTransform, unknownHandler);
                const valueSize = getSize(object.get(key), seen, keyId, itemTransform, unknownHandler);
                return  {
                    key: keySize,
                    value: valueSize,
                    size: keySize.size + valueSize.size,
                };
            });
            return itemTransform({
                id,
                type: 'map',
                size: res.reduce((acc, item) => acc + item.size, 0),
                values: res.sort((a, b) => b.size - a.size),
            });
        }

        // Set & WeakSet
        if (object instanceof Set || object instanceof WeakSet) {
            const res = [...object.values()].map((value, i) =>
                getSize(value, seen, `${id}[${i}]`, itemTransform, unknownHandler));
            return itemTransform({
                id,
                type: 'set',
                size: res.reduce((acc, item) => acc + item.size, 0),
                values: res.sort((a, b) => b.size - a.size),
            });
        }

        // Get props
        const props = [];
        for (const prop in object) props.push(prop);
        if (Object.getOwnPropertySymbols) Array.prototype.push.apply(props, Object.getOwnPropertySymbols(object));

        // Get the sizes
        const res = props.map(prop => {
            const propId = `${id}.${prop.toString()}`;
            const keySize = getSize(prop, seen, `${propId}\{key\}`, itemTransform, unknownHandler);
            const valueSize = getSize(object[prop], seen, propId, itemTransform, unknownHandler);
            return {
                key: keySize,
                value: valueSize,
                size: keySize.size + valueSize.size,
            };
        });

        // Wrap
        return itemTransform({
            id,
            type: 'object',
            size: res.reduce((acc, item) => acc + item.size, 0),
            values: res.sort((a, b) => b.size - a.size),
        });
    }

    // Unknown (functions)
    return itemTransform({
        id,
        type: 'unknown',
        size: 0,
        ...unknownHandler(object, seen, id),
    });
};

module.exports = ({ object, rootId, itemTransform, unknownHandler, initialSeen }) => {
    rootId = rootId || '{root}';
    itemTransform = itemTransform || (item => item);
    unknownHandler = unknownHandler || ((object) => ({ typeof: typeof object }));
    initialSeen = initialSeen || new WeakMap();
    return getSize(object, initialSeen, rootId, itemTransform, unknownHandler);
};
