// Thanks to https://github.com/miktam/sizeof for the basis of a lot of this

const ECMA_BYTE_SIZES = {
    STRING: 2,
    BOOLEAN: 4,
    NUMBER: 8
};

const getSize = (object, seen = new WeakSet()) => {
    // Buffer
    if (Buffer.isBuffer(object)) {
        return {
            type: 'buffer',
            size: object.length,
        };
    }

    const objectType = typeof object;

    // String
    if (objectType === 'string') {
        return {
            type: 'string',
            size: object.length * ECMA_BYTE_SIZES.STRING,
        };
    }

    // Boolean
    if (objectType === 'boolean') {
        return {
            type: 'boolean',
            size: ECMA_BYTE_SIZES.BOOLEAN,
        };
    }

    // Number
    if (objectType === 'number') {
        return {
            type: 'number',
            size: ECMA_BYTE_SIZES.NUMBER,
        };
    }

    // Symbol
    if (objectType === 'symbol') {
        return {
            type: 'symbol',
            size: Symbol.keyFor && Symbol.keyFor(object)
                ? Symbol.keyFor(object).length * ECMA_BYTE_SIZES.STRING
                : (object.toString().length - 8) * ECMA_BYTE_SIZES.STRING,
        };
    }

    // Array
    if (objectType === 'object' && Array.isArray(object)) {
        const res = object.map(innerObject => getSize(innerObject, seen));
        return {
            type: 'array',
            size: res.reduce((acc, item) => acc + item.size, 0),
            values: res,
        };
    }

    // Object
    if (objectType === 'object') {
        // Get props
        const props = [];
        for (const prop in object) props.push(prop);
        if (Object.getOwnPropertySymbols) Array.prototype.push.apply(props, Object.getOwnPropertySymbols(object));

        // Get the sizes
        const res = props.reduce((all, prop) => {
            // Get the key size
            const keySize = getSize(prop, seen);

            // Handle circular objects
            if (typeof object[prop] === 'object' && object[prop] !== null) {
                if (seen.has(object[prop])) {
                    all[prop] = {
                        key: keySize,
                        value: {
                            type: 'circular',
                            size: 0,
                        },
                        size: keySize.size,
                    };
                    return all;
                }
                seen.add(object[prop]);
            }

            // Not circular
            const valueSize = getSize(object[prop], seen);
            all[prop] = {
                key: keySize,
                value: valueSize,
                size: keySize.size + valueSize.size,
            };
            return all;
        }, {});

        // Wrap
        return {
            type: 'object',
            size: Object.values(res).reduce((acc, item) => acc + item.size, 0),
            values: res,
        };
    }

    // Unknown
    return {
        type: 'unknown',
        size: 0,
    };
};

module.exports = getSize;
