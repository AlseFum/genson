const example = {
    comment: [
        "this file is to show how a genson json is,approximately. And things under a `comment` key should all be ignored."
        ,"`type` means what the current node is. it should only be used in this way."
        ,"`default` refers to which item should be used to generate as the whole module. Can be item, decls, functions, or some what."
        ,"`$0` means use the first(item), as the item can't be accessed directly"
    ],
    type: "module",
    default: "$0",

    items: [
        {
            type: "seq",
            comment:"seq is to output items onebyone",
            items: [
                "Hello,",
                {
                    type: "option",
                    comment:"option is to select one item from items, with equal possibilities",
                    items: [
                        "Visitor",
                        "World",
                        "Banana"
                    ]
                },
                "!"
            ]
        }
        ,
        {
            type: "Roulette",
            comment:"Roulette is option with calculation of possibility,which calls weight",
            items: [{
                weight: "3",
                value: "Brazil"
            }, {
                weight: {
                    type: "expr",
                    comment:"expr=expression, easy to understand",
                    value: {
                        op: "+",
                        left: "3",
                        right: "1"
                    }
                },
                value: "Chile"
            }, {
                wt: "5",
                comment:"wt=weight",
                value: {
                    type: "expr",
                    value: "Pakistan"
                }
            }]
        },
        {
            type: "repeat",
            comment:"repeat the item by given times,sometime separator available. Maybe $index should be usable for expression",
            time: 3,
            items: {
                type: "option",
                items: ["A", "B", "C"]
            },
            separator: {
                type: "option",
                items: [";", ","]
            }
        },
        {
            type: "delegate",
            comment:"repeat with calculation of times.",
            time: { type: "expr", value: "4" },
            items: ["D", "E", { type: "expr", value: { op: "+", left: "3", right: "1" } }]
        }
        ,
        {
            type: "layer",
            comment:["a lite module,basically the `option`. Yet here can store so much thing concerning with context, and only layers have parent-children relation.",
        "props as you already known.","decls contains things that aren't used for generation, but for some other thing.",
        "and yes we have hooks.",
        "some generators have name, then we can access in the layer."
        ],
            
            decls: [
                {
                    type: "domain",
                    name: "dodo",
                    items: [{
                        value: "Bird",
                        range: [[1, 45], 78, 115]
                    }, {
                        value: "mammo",
                        range: [200, 201]
                    }],

                },
                {
                    type: "domain",
                    name: "pear",
                    items: [{
                        value: "round",
                        range: [[1, 45], 78, 115]
                    },],

                },
                {
                    type: "struct",
                    name: "snake",
                    items: [{
                        of: "dodo",
                        name: "member1"
                    }, {
                        of: "literal",
                        name: "member2",
                        default: 0
                    }]
                },
                {
                    type: "vec",
                    name: "vendor",
                    item: {
                        of: "snake"
                    },
                    size: { type: "expr", value: 45 }
                },
                {
                    type: "import",
                    comments:"yes, import. path tells how to import",
                    name: "imported_module",
                    path:"someprotocol://balabala",
                    decls: [/* here we omit these*/],
                    props: [/* here we omit these*/],
                    functions: {
                        comment:"function can't be declared in genson, instead, it's imported from environment",
                        foo: {
                            comments: "finally is when the environment implement is missing, how should the function return.",
                            finally: {
                                type: "expr",
                                value: "this expr is only used when the imported module's relative function is invalid."
                            }
                        }
                    }
                },
                {
                    type: "match",
                    name: "matcher1",
                    comment:"match is rust-like",
                    parameters: ["arg1", "arg2", {
                        type: "rest",
                        name: "argN"
                    }],
                    items: [
                        {
                            req: {
                                arg1: {
                                    of: "dodo"
                                },
                            },
                            to: 23
                        },
                        {
                            req: [
                                {
                                    of: "snake",
                                    as: "p",
                                    value: {
                                        type: "expr",
                                        value: {
                                            op: "eq",
                                            left: {
                                                op: "get",
                                                value: "p"
                                            },
                                            right: "round"
                                        }
                                    }
                                }, {
                                    //this is for arg2
                                }, {
                                    //this is for argN
                                }
                            ], to: { type: "expr", value: "matched" }
                        }
                    ],
                    otherwise: 23
                }
            ],
            props: {
                const1: "const_items",
                var1: {
                    comment:"of refers to a type(domain,struct or what)",
                    of: "dodo",
                    value: 23
                },
                // for side effects and conditions
                count: {
                    of: "literal",
                    value: 0
                },
                score: {
                    of: "literal",
                    value: 95
                },
                // simple list for indexing demo
                names: ["alice", "bob", "charlie"],
                // a struct instance for field access demo
                snake1: {
                    of: "snake",
                    value: {
                        member1: 200,
                        member2: 7
                    }
                }
            },
            // before 钩子：进入 layer 时先执行（副作用不输出）
            before: [
                {
                    type: "set",
                    path: "count",
                    value: {
                        type: "expr",
                        value: {
                            op: "+",
                            left: { op: "get", path: "count" },
                            right: 1
                        }
                    }
                }
            ],
            items: [
                // match 作为 filter 示例：对 var1 进行匹配
                {
                    type: "expr",
                    value: {
                        op: "match",
                        source: { op: "get", path: "parent.var1" },
                        by: ["matcher1"]
                    }
                },
                {
                    type: "seq",
                    items: [
                        "Grade: ",
                        {
                            type: "expr",
                            value: {
                                op: "?:",
                                cond: { op: ">=", left: { op: "get", path: "score" }, right: 90 },
                                then: "优秀",
                                else: {
                                    type:"ref",
                                    path:"parent.var1",
                                    comment:"yes we have ref"
                                }
                            }
                        }
                    ]
                },
                // 列表与结构体读取
                {
                    type: "seq",
                    items: [
                        "First name: ",
                        { type: "expr", value: { op: "get", path: "names[0]" } },
                        " | snake1.member2: ",
                        { type: "expr", value: { op: "get", path: "snake1.member2" } }
                    ]
                },
                {
                    type: "seq",
                    items: [
                        {
                            type: "effect",
                            items: [
                                {
                                    type: "set",
                                    path: "count",
                                    value: {
                                        type: "expr",
                                        value: {
                                            op: "+",
                                            left: { op: "get", path: "count" },
                                            right: 1
                                        }
                                    }
                                }
                            ]
                        },
                        "After effect count: ",
                        { type: "expr", value: { op: "get", path: "count" } }
                    ]
                }
            ]
        }
        ,
    ],
    props: {}
}
import fs from 'fs';
export default example;
const jsonStr = JSON.stringify(example, null, 2);
fs.writeFileSync('example.json', jsonStr);