const getSize = require('../');

console.log(JSON.stringify(getSize({
    a: 'hello',
    b: 10,
    c: [1, 2, 'a', 'b'],
    d: {
        hello: 'world',
        nested: ['a', 'r', 'r', 'a', 'y'],
    },
}), null, 2));
