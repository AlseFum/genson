### 语义想法

`#`表示行内特殊内容，也用于声明一些特殊对象

 比如`#match`

 `$`表示变量和上下文相关

 `@`表示函数与hook

 方括号表示一个表达式，花括号表示一段代码，可运行，不一定输出

 `^`与`~`表示导航

 `!`表示宏？

 `&*`分别表示解引用和引用？

使用extern让外部补足复杂性，内部仍然保持简洁和表现力

## 基础结构：生成器

使用缩进表示层级结构和随机选择。子项会从同一缩进级别中随机选择一个，并继续尝试向下随机：

```plain
item
    itemA
    itemB
item2
    item2A
    item2B
```
表明可能会从item或者item2取值，就是是其下的itemA/B,item2A/B
 最终可能生成 itemA,itemB,item2A,item2B其中任一

>这样的列表的类型是内建的Generator
>identifer 名字
>示例中无缩进的首行是`名字`，用于引用。
>   名字以特殊字符开头时，须使用引号包裹。当然不以特殊字符开头也可以用引号包裹。 
```plain
item with white space
    item3A
    item3B
1more
    perusona！
":devil may cry"
```
### 多行合一

使用`\`表示转行而非新项

```plain
MultilineExample
    line1\
    line2#(1|2|3)
    line3
```
就会输出line1line22或者line3 
### 注释

使用`//`开始单行注释：

```plain
item
    // 这是注释
    itemA  // 行尾注释
    itemB
```
多行注释使用`/* */`：
```plain
/*
这是多行注释
可以跨越多行
*/
item
    value
```
### 空值与可选内容

使用空字符串表示"可能什么都不生成"：

```plain
optional
    something

    another thing
```
上面第二行为空，表示有概率不输出任何内容。
### 格式控制

特殊转义序列用于控制输出格式：

* `\n` - 换行符

* `\t` - 制表符

* `\s` - 空格（用于需要明确空格时）

* `\\` - 反斜杠本身

```plain
poem
    第一行\n第二行\n\t缩进的第三行
```
首尾空格保留：
```plain
item
    \s\s有前导空格
    有尾随空格\s\s
```
### 转义字符

特殊字符需要转义：

* `\$` - 字面美元符号

* `\#` - 字面井号

* `\[\]` - 字面方括号

* `\\` - 字面反斜杠

```plain
price
    The price is \$#[$amount]
```
### 行内快速随机

```plain
Hello #(world|human|my life)!
```
`#(arg1|arg2|argN...)`也是随机列表，写起来更快，但不可用作其他地方
 其定义会被定义在上一级中，作为匿名列表

 括号可以嵌套

 括号内的文字仍优先被认定为普通文字，而非程序内容。

 如果里面的值含有`|`，需要使用引号。

### 不均等权重

```plain
item
    itemA
    ^2 itemB
Hello #(^2 world|human|my life)!
```
上面的计法都表明权重被更改了，数字即表示占用原来多少份的概率
 ^n后面的那个空格会被认定为分隔使用，而不出现在文字中

### 使用其他item

```plain
item
    itemA
    itemB
item2
    #item 2
    #"item with white space" 2
```
上面两种写法都表示引用，在生成item2时会生成item的值插入进去。
 其中没有引号的写法，其后第一个空格会被省略，因为其作为隔断使用。

 有引号的写法表示引用那些名字用了空格或者特殊字符的。

 *注意，如果某一行的内容使用了其他item，或者特殊计法，它将不能继续往下随机，其下层将是特殊逻辑。*

 *这部分将在之后论述*

### 内部item

>如果某一行的内容使用了其他item，或者特殊计法，它将不能继续往下随机，其下层将是特殊逻辑
>   其仍可继续往下写子层。子层定义的item只对此层可见 
```plain
Foo
    line0
    line1#subitem
        subitem
            a
            b
            c
    line2#subitem
```
就可能抽出line1a，line1b，line1c，line2 （line2找不到subitem，就没有插值）
 当然，父级item对子级一定是可见的。subitem内可以访问line1，自身的父级用parent访问，其他父级暂时没有设计

### 递归与引用深度

引用可以递归，但需要注意避免无限循环：

```plain
sentence
    #sentence and more
    done
```
系统会在递归深度超过一定上限时自动终止并报错。
### 多重引用与组合

可以在一行中多次引用：

```plain
greeting
    #name meets #name
name
    Alice
    Bob
    Charlie
```
上面可能生成"Alice meets Bob"等组合。每次引用都会重新生成。
 如果需要保持一个结果，请使用变量

### 重复生成

使用 `#*n` 来重复生成内容：

```plain
list
    #*3item
```
简单重复3次item，整数后直接跟item名称即可。
```plain
numbered
    #*3`第#i项：#item\n`
```
特殊变量 `#i` 在重复中表示当前索引（从1开始）。
## 变量

### 变量

变量被使用一般需要声明

```plain
$a : num = 114514
$b = "str"
$c : itemFoo
```
变量可以为数字，字符串变量，和生成结果。
 变量可以被使用。未设置初值的会被设置初值。

 如a默认为0，b默认为"，c默认为Nih

 这里#item只是表示类型，实际上没有赋值。

 要赋值得加上等于号之后的内容

 可以加上const，once，等关键字

 变量只在声明层级以及更深处有效

```plain
$d: const jack #o-lantern = ...
```
### 插值

```plain
YetAnotherItem
    a is $a
    b is $b
    c is $c
```
上面即将变量值作为文本输出。其中c在被访问时如果没有赋初值，会显示为None
 特别地，如果$var=item而不是$var:item,将会在每次$var时返回动态评估item的结果

 #item 确实可以被用作变量类型，但是行为暂时没有设计

### 保持引用一致性

如果想在同一次生成中保持引用结果一致，使用变量：

```plain
$person = #name
greeting
    $person meets $person
```
这样会生成"Alice meets Alice"而不是两个不同的名字。
```plain
greeting
    $person=#person meets $person
```
也可以这样，不过范围仅限于行内了
### 表达式

变量可以参与数值运算和字符串拼接：

```plain
$x : num
$y : num
calculation
    Sum is #[x + y]
    Product is #[x * y]
```
`[expression]`用于计算表达式并输出结果。
 **注意**：表达式内部是纯计算，不能对外界造成任何影响（不能包含赋值、副作用等）。

 表达式内视作程序部分，而非文本部分

 支持的运算符：

* 数值：`+`, `-`, `*`, `/`, `%`（取模）

* 比较：`>`, `<`, `>=`, `<=`, `==`, `!=`

* 逻辑：`and`, `or`, `not`

* 字符串：`+`（拼接）

### 副作用与赋值

副作用允许在生成过程中修改变量值，使用`#{}`语法包裹。

```plain
$count : num
item
    Hello #{count = count + 1}\
    You are visitor number $count
```
多个副作用可以连续执行：
```plain
$a : num
$b : num
complex
    #{a = 5}#{b = 10} Result: $a and $b
```
副作用不会输出任何文本，只改变状态。
**特别地**，可以在行中任意位置进行赋值：

```plain
$mood = "happy"
story
    The hero #{mood = "angry"} started fighting.\
    He was very $mood during the battle.
```
赋值操作可以穿插在文本中，不影响输出，但会改变后续的变量值。
 问题在于是否必要？

### 动态控制次数

```plain
$count=3
greet
    #*[count]item
```
### 动态权重

```plain
$importance : num
greeting
    Hello #(^[$importance]world|human|my life)!
$mood : num
story
    The hero feels #(^[mood * 2]happy|^[mood]sad|neutral)
```
这样可以根据变量值动态调整选项的权重。权重表达式会在生成时计算，支持所有数值运算。
 字符串取权重默认为1.

### 条件语句

使用`?:`三元运算符或条件块：

```plain
$score : num
grade
    Your score is $score
    #[$score >= 90 ? "优秀" : "继续努力"]
```
### 内建变量与函数

这些变量是内部设置（用户，系统）而非生成的

1. URL里query设置了的

2. 一些系统常量，用户localstorage或者cookie里的 （现在先留空） 函数设计包括一些字符串转权重啊什么的

## 之后的都不一定被实现

### 列表和数组

声明和使用列表：

**列表声明**：

```plain
$names = ["Alice", "Bob", "Charlie"]
$scores = [85, 90, 75]
$empty = []
```
**访问元素**：
```plain
test
    第一个名字：$names[0]
    第二个分数：$scores[1]
    随机名字：$names[#[randint(0, 2)]]
```
**列表操作**：
* `#[len($names)]` - 获取长度

* `$names[#[len($names) - 1]]` - 获取最后一个元素

* `#{$names.append("David")}` - 添加元素（副作用）

* `#{$names.pop()}` - 移除最后一个元素

**遍历列表**：

```plain
allNames
    #*len($names){$names[#i - 1]\n}
```
### 引用时的后处理

引用item或变量时可以应用后处理：

```plain
name
    alice
    bob

story
    $name|upper 说："你好！"
    #name|upper 回答道："嗨！"
```
生成：`ALICE 说："你好！"` 或 `BOB 回答道："嗨！"`
**支持的后处理**：

* `|upper` - 转大写

* `|lower` - 转小写

* `|title` - 首字母大写

* `|reverse` - 反转字符串

* `|trim` - 去除首尾空格

乃至于其他操作（类型自建转化？）

>可以看到#合$在这时起到一个generate的语义（？ 
#### 声明模式匹配

使用 `#match` 为开头的行，之后算做一个模式匹配器

 分支就是条件1，条件2 =》返回值，这样的

 十分类似Rust

 因为比较好写吧

 这个可以做到后处理那

#### 自定义#宏

这个就得自行编辑python代码了

#### 数域枚举

以一个数字范围为基础，设置其中的一些项为特殊对应

 比如Color 1=red 2=green 3=blue, 最小的4-255都没用上，就可以4-255=unknown

 然后除了数字固有的add，sub，还可以设置一些变换，来在域里变换。

 特别地，与字符串比较时，会匹配枚举值。

#### 首行作用

```plain
MyItem
    #before
        $a=4
        $c=$a+$b
    #[$a+$c]
    None
```
#开头的都有特殊作用
 这个会在进入MyItem时立刻进行，之后再计算概率，进入分支

#### 函数

只能用module来做

## Module

环境提供的包，里面有因环境而异的函数

## #prop

可以给生成器写挂载的变量，外界可以访问

## #domain

只针对具体值

用来加速数字与字符串的比较和转换


# GenLangSchema

这个用于描述genlang生成的json，以生成文本

GenLang以一个个节点套成，就是AST

每个节点有一个evaluate方法，用于将此节点进行一次评估，生成确定的，不再会更改的节点

还有一个toString方法，只应该被生成输出时调用，输出程序内部的文本用以拼接

## Text

最简单的东西，一般作为evaluate的产物

因此，有个source属性作为记载其生成的源头

具体怎么用还不清楚了

* source

* evaluate()

* toString()

## Sequence

用于包裹一串连续的节点，evaluate时要依次对内evaluate

* items

* ~

## Option

内部没有权重分布的，列表

evaluate会简单随机到某个值，然后作为结果

## Roulette

需要进行权重评估的Option

## Repeation

重复，你知道的

## Delegate

带表达式的Repeation
## Ref
引用，都知道的

## 高级内容

## #Generator

附加了特殊内容的节点，高级内容以Generator的包含关系为层级，递进上下文。

## #Module

每个生成器文档都是一个module，然而，从外界导入的也是module

对module的各种访问都有失败的风险

Module也是Generator

## #prop

能够被访问的变量，与var不同

每次evaluate，变量都会包含在返回的Text().source里头

## #Domain

GenLang对数字的特殊用法，通过指定额外的属性，方便不同用途的数字之间，数字与文本之间的转换

比如

```plain
#Domain X:
  partA:3~34,78,114
  partB:89
```
就会有(X(21)=="partA")==true
还可以与Match配合。

Domain有特殊的作用，而evaluate没有作用。

Domain对应的schema：

{

type:"domain",

name:"X",

branch:[

{

string:"partA",

range:[

[3,34],78,114

]},

{

string:"partB",

range:89

}

]

}

## Vec&Struct

对struct的访问必须在编译时检查

而对Vec的访问必须都要有失败时的else

## #Match

模式匹配，套模式匹配！

#match somematcher:

Domain1(1) -> balabala;

Struct2(prop1=23,prop2=...) -> balabala;

Struct(anothermatcher(n)=Domain3(3,...)) ->balabala;

同样不应该evaluate。

对应schema：

{

type:"match",

name:"somematcher",

branch:[

{

req:[

{

domain:"Domain1",

index:1,

expr:["eq",1]

},

...

,

to:"string"

]

}



]


}

## #Expression

你我都熟的表达式。

+-*/，除此以外，instance1.matchfn()会访问对应的matcher，返回一个新的值

而instance1->matchfn()会改变自身，并返回自身

matchfn可以是变量，可以是自己声明的matchfn

特别地，有个“|”用于进行match。怎么用呢？左+右吧，右边以&分割。


