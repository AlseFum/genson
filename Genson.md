## Idea

用于生成文本的中间形式AST。

将支持Genlang的所有内容

每个Genson文件都是一个JSON文件。

Genson树也是由节点嵌套而成。

## 节点

节点是有`type:string`属性的object。

`value`属性为此类型节点具有特殊用途的内容

`items`属性则大多指向子节点。

## 生成

每个节点类型都定义有toText方法，会返回一个特殊的Text节点，此Text节点的toString方法才会返回最终的文本。

Layer节点会让上下文向深递进一层，满足`shadowing`等操作。

如果onEnter，onLeave有定义，会相应地先在上下文中使用。

## 变量

有三种类型：

-domain的数字

-以Layer为结构的结构体

-数组

-字符串。需要注意，有Domain数字后，字符串只应在表达时使用。


每种变量都能变换为其他类型的变量

使用这些变量请参考Expression节点的说明。

### Domain

带有属性的数字，可以方便地设置为字符串，映射到另一个域的数字

转为数组时，就是一个Range数组，从零到具体值，除非有特殊规定。

只能在声明时规定特殊的处理方式。

默认数字的domain是`Literal`。

### Vector

同质的内容。

转化为Domain/Struct时，会直接使用第一个元素，或者Literal(None)

### Layer

可以作为上下文的结构体。

转为数组时，就是一个元素的数组。

转为数字时，除非有特殊规定，否则Literal(1)

## 变换

match形式的谓词

调用变换时应当满足purity

## 节点列表

### Seq

一系列连续的节点。

* items

### Option

随机性相等的节点，随机选一个作为输出

* items

### Roulette

会计算随机性地随机抽取

* items：[weight,value]

### Repeat

简单地随机重复

* range：不好说

* value

### Delegate

* range：不好说

* value

### Layer

层节点。装很多东西。不仅作为生成器，还要作为结构体声明，还要作为ref的对象。

Layer生成文本，也是在items中随机抽取一个。允许Option和Roulette两种形式。没有规定weight就默认为1.

>注意，并不特别推荐使用vector
* items:仍然是数组，表达其下的Layer，如果Layer需要被引用，在另外的属性里。

* refs:{}键值，值是指向items具体项的索引。

* props：{}结构体定义，键是变量名，值是指向类型的字符串或者别的

* onEnter，onLeave 都是可选的副作用。

* decls：match的定义，domain的定义，等。

### Module

文档节点，具体实现因实现而异。

* entry，其实是一个Ref，指向toText时调用的东西，也就是refs里的名字。默认用main

* path，用于指示可能的import。

* refs:{}实际上会使用的东西。这里的值就是实际的东西，而非items数组。

* decls:{}

### Expression

重头戏，emmm。

从用途看：返回重复范围，返回权重，返回内容用于genson

Expression内部的内容，不再使用type，而是op

另外，很明显允许副作用。

* value 就是expression的根节点

### Declaration

这些都应该放在decls里

用于声明domain类型， 或者match

结构体不用声明。

### Property

都放在props里，用于设置变量

当然，特殊的东西也会视作Property

每个property都只能是字面量，或者函数/match传入字面量的结果，就是都是constexpr。

property也意味着在onEnter之前的初始化。

比如a:"MyDomain:23",

b:{type:"expr",value:{op:"match",ref:"init",args:{"arg1":"AnotherDomain:24","arg2":"SomeStruct(2,AnotherAnotherDomain:445)"}}}

## 表达式

1. 字面量

这些没有op，直接在ast中使用。

数字：JSON数字被视为Literal:x

"Domain:x"就是特定域的数字。

注意，没有字符串字面量，表达式中没有。

"Identifier(arg1,arg2,arg3)"是结构体声明。arg1，arg2都得是字面量。

>这个结构体声明是必要的吗？
>要不要在这里加数组？数组该不该是字面量？
2. 字面构造式 vec/struct

emmm

3. ref：引用

查找并非当前作用域能够直接使用的值，类型等。

这块暂缓书写。

特别地，"_"是上下文的parent，以便查询。

* path

1. cast： 直接类型转换

这里是作为默认转换使用的。

* to 要转到的类型

* source 哪个要转

1. call

调用内部提供的函数。注意，只允许内部提供，或者module给。

* ref 这里默认就是ref类型。

* args 一个object，可以以arg1，arg2类似于数组

2. match

调用match。

* ref 这里默认就是ref类型。

* args 一个object，可以以arg1，arg2类似于数组

3. +-*/ add sub mul div

四则运算，左优先。

注意，进行这些运算，右边都会强转到数字，只有整数除法。

1. if/for/while

你知道的。for/while会返回数组。

1. =/+=/|= set/inc/match_mut

你知道的。

## Declaration

domain和match作为decls存在，而Struct也就是Layer。

而存储用的键名就是它的名字

### Domain

属性只设置一个range。

然后剩下的都是用于类型转换的match和函数ref，或者插值形式的expression。

to开头的都是类型转换函数。

* range

* toAnotherDomain

* toAnotherType

### Match

允许，依赖注入？

按branch来。

每个branch都是，arg：{表达式}=》表达式

表达式：难点，延迟。

Match允许最大深度的调用和递归。

