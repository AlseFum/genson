# GenLang 语言规范

## 语义设计

### 特殊字符含义

- `#` - 表示行内特殊内容，也用于声明特殊对象（如 `#match`）
- `$` - 表示变量和上下文相关内容
- `@` - 表示函数与 hook
- `[]` - 方括号表示表达式
- `{}` - 花括号表示代码块，可运行，不一定输出
- `^` 与 `~` - 表示导航
- `!` - 表示宏
- `&` 与 `*` - 分别表示解引用和引用

### 设计原则

使用 `extern` 让外部补足复杂性，内部仍然保持简洁和表现力。

## 基础结构：生成器

### 层级结构与随机选择

使用缩进表示层级结构和随机选择。子项会从同一缩进级别中随机选择一个，并继续尝试向下随机：

```genlang
item
    itemA
    itemB
item2
    item2A
    item2B
```

表明可能会从 `item` 或者 `item2` 取值，即其下的 `itemA/B` 或 `item2A/B`。最终可能生成 `itemA`、`itemB`、`item2A`、`item2B` 其中任一。

这样的列表的类型是内建的 `Generator`。

### 标识符命名

示例中无缩进的首行是名字，用于引用。名字以特殊字符开头时，须使用引号包裹。当然不以特殊字符开头也可以用引号包裹。

```genlang
item with white space
    item3A
    item3B

1more
    perusona！

":devil may cry"
```
### 多行合并

使用 `\` 表示转行而非新项：

```genlang
MultilineExample
    line1\
    line2#(1|2|3)
    line3
```

就会输出 `line1line22` 或者 `line3`。

## 注释

### 单行注释

使用 `//` 开始单行注释：

```genlang
item
    // 这是注释
    itemA  // 行尾注释
    itemB
```

### 多行注释

使用 `/* */` 包裹多行注释：

```genlang
/*
这是多行注释
可以跨越多行
*/
item
    value
```
## 空值与可选内容

使用空字符串表示"可能什么都不生成"：

```genlang
optional
    something

    another thing
```

上面第二行为空，表示有概率不输出任何内容。

## 格式控制

### 转义序列

特殊转义序列用于控制输出格式：

- `\n` - 换行符
- `\t` - 制表符
- `\s` - 空格（用于需要明确空格时）
- `\\` - 反斜杠本身

```genlang
poem
    第一行\n第二行\n\t缩进的第三行
```

### 首尾空格保留

```genlang
item
    \s\s有前导空格
    有尾随空格\s\s
```

### 转义字符

特殊字符需要转义：

- `\$` - 字面美元符号
- `\#` - 字面井号
- `\[\]` - 字面方括号
- `\\` - 字面反斜杠

```genlang
price
    The price is \$#[$amount]
```
## 行内快速随机

```genlang
Hello #(world|human|my life)!
```

`#(arg1|arg2|argN...)` 也是随机列表，写起来更快，但不可用作其他地方。

- 其定义会被定义在上一级中，作为匿名列表
- 括号可以嵌套
- 括号内的文字仍优先被认定为普通文字，而非程序内容
- 如果里面的值含有 `|`，需要使用引号

## 权重控制

### 不均等权重

```genlang
item
    itemA
    ^2 itemB

Hello #(^2 world|human|my life)!
```

上面的写法都表明权重被更改了，数字即表示占用原来多少份的概率。

> **注意**：`^n` 后面的那个空格会被认定为分隔使用，而不出现在文字中。
## 引用其他项

### 基本引用

```genlang
item
    itemA
    itemB

item2
    #item 2
    #"item with white space" 2
```

上面两种写法都表示引用，在生成 `item2` 时会生成 `item` 的值插入进去。

- 没有引号的写法，其后第一个空格会被省略，因为其作为隔断使用
- 有引号的写法表示引用那些名字用了空格或者特殊字符的

> **注意**：如果某一行的内容使用了其他 item，或者特殊计法，它将不能继续往下随机，其下层将是特殊逻辑。
### 内部项

如果某一行的内容使用了其他 item，或者特殊计法，它将不能继续往下随机，其下层将是特殊逻辑。

其仍可继续往下写子层。子层定义的 item 只对此层可见：

```genlang
Foo
    line0
    line1#subitem
        subitem
            a
            b
            c
    line2#subitem
```

就可能抽出 `line1a`、`line1b`、`line1c`、`line2`（`line2` 找不到 `subitem`，就没有插值）。

当然，父级 item 对子级一定是可见的。`subitem` 内可以访问 `line1`，自身的父级用 `parent` 访问，其他父级暂时没有设计。
### 递归与引用深度

引用可以递归，但需要注意避免无限循环：

```genlang
sentence
    #sentence and more
    done
```

系统会在递归深度超过一定上限时自动终止并报错。

### 多重引用与组合

可以在一行中多次引用：

```genlang
greeting
    #name meets #name

name
    Alice
    Bob
    Charlie
```

上面可能生成 "Alice meets Bob" 等组合。每次引用都会重新生成。

> **提示**：如果需要保持一个结果，请使用变量。
## 重复生成

使用 `#*n` 来重复生成内容：

```genlang
list
    #*3item
```

简单重复 3 次 `item`，整数后直接跟 item 名称即可。

### 带索引的重复

```genlang
numbered
    #*3`第#i项：#item\n`
```

特殊变量 `#i` 在重复中表示当前索引（从 1 开始）。
## 变量

### 变量声明

变量被使用一般需要声明：

```genlang
$a : num = 114514
$b = "str"
$c : itemFoo
```

变量可以为数字、字符串变量和生成结果。

- 变量可以被使用。未设置初值的会被设置初值
- 如 `a` 默认为 `0`，`b` 默认为 `""`，`c` 默认为 `Nil`
- 这里 `#item` 只是表示类型，实际上没有赋值
- 要赋值得加上等于号之后的内容
- 可以加上 `const`、`once` 等关键字
- 变量只在声明层级以及更深处有效

```genlang
$d: const jack #o-lantern = ...
```
### 变量插值

```genlang
YetAnotherItem
    a is $a
    b is $b
    c is $c
```

上面即将变量值作为文本输出。其中 `c` 在被访问时如果没有赋初值，会显示为 `None`。

- 特别地，如果 `$var=item` 而不是 `$var:item`，将会在每次 `$var` 时返回动态评估 `item` 的结果
- `#item` 确实可以被用作变量类型，但是行为暂时没有设计

### 保持引用一致性

如果想在同一次生成中保持引用结果一致，使用变量：

```genlang
$person = #name
greeting
    $person meets $person
```

这样会生成 "Alice meets Alice" 而不是两个不同的名字。

```genlang
greeting
    $person=#person meets $person
```

也可以这样，不过范围仅限于行内了。
## 表达式

变量可以参与数值运算和字符串拼接：

```genlang
$x : num
$y : num
calculation
    Sum is #[x + y]
    Product is #[x * y]
```

`#[expression]` 用于计算表达式并输出结果。

> **注意**：表达式内部是纯计算，不能对外界造成任何影响（不能包含赋值、副作用等）。表达式内视作程序部分，而非文本部分。

### 支持的运算符

- **数值**：`+`, `-`, `*`, `/`, `%`（取模）
- **比较**：`>`, `<`, `>=`, `<=`, `==`, `!=`
- **逻辑**：`and`, `or`, `not`
- **字符串**：`+`（拼接）
## 副作用与赋值

副作用允许在生成过程中修改变量值，使用 `#{}` 语法包裹。

```genlang
$count : num
item
    Hello #{count = count + 1}\
    You are visitor number $count
```

### 多个副作用

多个副作用可以连续执行：

```genlang
$a : num
$b : num
complex
    #{a = 5}#{b = 10} Result: $a and $b
```

副作用不会输出任何文本，只改变状态。

### 行内赋值

特别地，可以在行中任意位置进行赋值：

```genlang
$mood = "happy"
story
    The hero #{mood = "angry"} started fighting.\
    He was very $mood during the battle.
```

赋值操作可以穿插在文本中，不影响输出，但会改变后续的变量值。
## 动态控制

### 动态控制次数

```genlang
$count=3
greet
    #*[count]item
```

### 动态权重

```genlang
$importance : num
greeting
    Hello #(^[$importance]world|human|my life)!

$mood : num
story
    The hero feels #(^[mood * 2]happy|^[mood]sad|neutral)
```

这样可以根据变量值动态调整选项的权重。权重表达式会在生成时计算，支持所有数值运算。

> **注意**：字符串取权重默认为 1。
## 条件语句

使用 `?:` 三元运算符或条件块：

```genlang
$score : num
grade
    Your score is $score
    #[$score >= 90 ? "优秀" : "继续努力"]
```
## 内建变量与函数

这些变量是内部设置（用户、系统）而非生成的：

- URL 里 query 设置了的
- 一些系统常量，用户 localStorage 或者 cookie 里的（现在先留空）
- 函数设计包括一些字符串转权重等功能

> **注意**：之后的都不一定被实现。

## 列表和数组

### 列表声明

```genlang
$names = ["Alice", "Bob", "Charlie"]
$scores = [85, 90, 75]
$empty = []
```

### 访问元素

```genlang
test
    第一个名字：$names[0]
    第二个分数：$scores[1]
    随机名字：$names[#[randint(0, 2)]]
```

### 列表操作

- `#[len($names)]` - 获取长度
- `$names[#[len($names) - 1]]` - 获取最后一个元素
- `#{$names.append("David")}` - 添加元素（副作用）
- `#{$names.pop()}` - 移除最后一个元素

### 遍历列表

```genlang
allNames
    #*len($names){$names[#i - 1]\n}
```
## 后处理

引用 item 或变量时可以应用后处理：

```genlang
name
    alice
    bob

story
    $name|upper 说："你好！"
    #name|upper 回答道："嗨！"
```

生成：`ALICE 说："你好！"` 或 `BOB 回答道："嗨！"`

### 支持的后处理

- `|upper` - 转大写
- `|lower` - 转小写
- `|title` - 首字母大写
- `|reverse` - 反转字符串
- `|trim` - 去除首尾空格

乃至于其他操作（类型自建转化？）

可以看到 `#` 和 `$` 在这时起到一个 generate 的语义。 
## 高级功能

### 模式匹配

使用 `#match` 为开头的行，之后算做一个模式匹配器：

- 分支就是 `条件1，条件2 => 返回值` 这样的
- 十分类似 Rust
- 因为比较好写
- 这个可以做到后处理

### 自定义宏

这个就得自行编辑 Python 代码了。

### 数域枚举

以一个数字范围为基础，设置其中的一些项为特殊对应：

比如 `Color 1=red 2=green 3=blue`，最小的 4-255 都没用上，就可以 `4-255=unknown`。

然后除了数字固有的 `add`、`sub`，还可以设置一些变换，来在域里变换。

特别地，与字符串比较时，会匹配枚举值。
### 首行作用

```genlang
MyItem
    #before
        $a=4
        $c=$a+$b
    #[$a+$c]
    None
```

`#` 开头的都有特殊作用。这个会在进入 `MyItem` 时立刻进行，之后再计算概率，进入分支。

### 函数

只能用 module 来做。

### Module

环境提供的包，里面有因环境而异的函数。

### #prop

可以给生成器写挂载的变量，外界可以访问。

### #domain

只针对具体值，用来加速数字与字符串的比较和转换。

---

# GenLangSchema

本文档用于描述 GenLang 生成的中间表示Genson。
每份Genson文件是一颗JSON形式的抽象语法树，根节点必为`Module`类型。。
Genson中的每个节点都是一个对象，且必有`type`属性用于区分其类型。
节点本身是纯数据结构，不包含可执行方法；本文档中描述的方法只描述外部引擎实现的行为（如 `evaluate`、`toString`）。
大部分节点都有`evaluate`方法，以生成确定的、不再会更改的`Text`节点用于确定输出的文本。
## AST 节点类型
### Text

最简单的节点，一般作为 `evaluate` 的产物。
其`source` 属性作为记载其生成的源头，一些场景下，可以通过`source`生成新的文本。
其`toString`方法用于输出纯文本。

**属性：**
- `source`
- `text`

### Sequence

用于包裹一串连续的节点。
`evaluate`会将`items`中各项依次evaluate之后拼接起来。其`type`可简写为`seq`

**属性：**
- `items`

### Option

内部没有权重分布的列表。`evaluate` 会简单随机到某个值，然后evaluate，作为结果。
**属性：**
- `items`

### Roulette

需要进行权重评估的 `Option`。
**属性：**
- `items`

**item:**
- `weight` 表达式，也可简写为`wt`
- `value` 实际将evaluate的节点

### Repetition

重复，你知道的。可以内部插入一些变量。

**属性：**
- `times`
- `value` 实际将evaluate的节点
- `separator` 可选，插入value值中的Item

### Delegate

带表达式的 `Repetition`。
**item:**
- `weight` 表达式，每次都会动态评估
- `value` 实际将evaluate的节点
- `separator` 可选，插入value值中的Item

### 示例
以下示例可能不满足JSON语法，不过应该不影响

```
{
    type:"module",
    default:{
        type:"Roulette",
        items:[
            {
                value:{
                    type:"seq",
                    items:[
                        "Hello, ",
                        {
                            type:"option",
                            items:["Visitor","World",{type:"seq",items:["(No","Whitespace_here)"]}]
                        }
                    ]
                },
                weight:"0x12"
            },
            {
                value:{
                    type:"repetition",
                    value:"Ook ",
                    times:3
                },
                wt:{
                    comment:"we'll explain expr and call later",
                    type:"expr",
                    op:"+",
                    left:1,
                    right:{
                        type:"call",
                        path:"rand_int",
                        args:[1,14]
                    }
                }
            },
            {
                type:"delegate",
                weight:{type:"ref",to:"a_value_that_maybe_hundred_or_thousand.dependOn(teacher.feeling)"},
                separator:",",
                value:"I spelt Apple wrong. "
            }
        ]
    }
}
```
## 高级节点

### Layer

`Layer`表达了GenLang里的上下文层级关系，其`evaluate`行为基本与Roulette一致。
同时，`Layer`还有一些高级成分。`prop`描述了所有`items`生成过程中需要的变量，在evaluate时，这些变量可能会被打包成一个`context`作为生成的Text节点的`source`以便重新生成。`decl`包含在这个Layer中可用的类型，match表达式，等其他不会evaluate的东西。`prop`也使得`Layer`拥有了类似C中struct那样的存储能力。
特别地，Layer的items可以具有名字，以进行引用。（具体之后会说）
**属性：**
- `prop`
- `decl`
- `items`

#### 使用 decl

`decl` 是一个对象，用于声明在当前 Layer 中可用的类型定义、Match 表达式等不会参与 `evaluate` 的节点。这些声明可以在 Layer 的 `items` 生成过程中被引用和使用。

**decl 中可以包含的节点类型：**
- **Match** - 模式匹配器，可以在 Expression 中通过 `instance.matchfn()` 或 `left | matcherName, ...` 的方式调用
- **Domain** - 数字域定义，用于数字到字符串的映射，可以在 Match 的 `req` 中使用
- 其他类型定义节点（根据具体实现）

**decl 的使用示例：**

```json
{
  "type": "layer",
  "name": "MyLayer",
  "prop": {
    "$count": {
      "type": "var",
      "name": "$count",
      "type": "num",
      "value": 0
    }
  },
  "decl": {
    "ColorMatcher": {
      "type": "match",
      "name": "ColorMatcher",
      "branch": [
        {
          "req": [
            {
              "domain": "Color",
              "index": 0
            }
          ],
          "to": {
            "type": "text",
            "text": "red"
          }
        }
      ]
    },
    "Color": {
      "type": "domain",
      "name": "Color",
      "branch": [
        {
          "string": "red",
          "range": [1, 10]
        },
        {
          "string": "blue",
          "range": [11, 20]
        }
      ]
    }
  },
  "items": {
    "type": "roulette",
    "items": [
      {
        "weight": 1,
        "value": {
          "type": "expression",
          "op": "|",
          "left": {
            "type": "expression",
            "expr": [1]
          },
          "right": [
            {
              "type": "ref",
              "to": "ColorMatcher"
            }
          ]
        }
      }
    ]
  }
}
```

在上面的示例中：
- `ColorMatcher` 是一个在 `decl` 中声明的 Match 节点，可以在 Expression 中通过 `value | ColorMatcher` 的方式调用
- `Color` 是一个在 `decl` 中声明的 Domain 节点，可以在 Match 的 `req` 中通过 `"domain": "Color"` 的方式引用

### Module

Module表示作为独立文档的节点。也因此，Module有可能来自外部。
我们不能绝对地确定外部文档的内容，因此，我们能够有限制地访问Module，在出错时，使用对应的else表达式。
**属性：**
- `name` 内部使用的全局Identifier
- `path` 指向Module地址，可能是URL路径，也可能是其他的。
- `entry` 一个名称，指向其`items`中的内容。如果指向无效，则是文档本身的问题，会报错
- `items` 其可以访问的内容
**item**
- `value` 这个属性一般不能被访问，属于内部
- `name` 这个item被以什么名字挂载在Module上
- `else` 一个节点，如果value失效，访问这个item时会返回何种结果。注意，是无论如何访问。无论作为普通节点，函数，还是match。
### Var

用于声明变量，通常出现在 Layer 的 `prop` 中。变量在 Layer 的 `evaluate` 过程中可以被访问和修改，并且在生成 Text 节点时，这些变量会被打包成 `context` 作为 `source` 的一部分，以便后续重新生成。

变量可以有类型声明和初始值。如果未设置初始值，会根据类型设置默认值（数字默认为 `0`，字符串默认为 `""`，生成结果默认为 `Nil`）。

**属性：**
- `name` 变量名，如 `"$a"`、`"$count"` 等
- `type` 可选，变量类型，如 `"num"`、`"str"` 或生成器类型
- `value` 可选，变量的初始值（表达式节点）
- `const` 可选，布尔值，表示是否为常量
- `once` 可选，布尔值，表示是否只初始化一次
### Vec

用于表示数组或列表类型，可以存储多个元素。`evaluate` 会返回数组本身，不进行转换。

对 Vec 的访问（如通过索引访问元素）必须提供失败时的 `else` 处理，因为索引可能越界或访问可能失败。这确保了访问的安全性。

Vec 可以包含任意类型的元素，元素类型可以相同或不同。

**属性：**
- `items` 数组元素列表，每个元素是一个节点
- `else` 可选，当访问 Vec 失败时（如索引越界）返回的备用节点
### Ref

用于引用其他节点，通常引用 Layer 中定义的 item 或其他可访问的内容。`evaluate` 会根据路径查找目标节点，然后 evaluate 该节点并返回结果。

Ref 使用路径（path）来定位目标节点。路径可以是简单的名称（如 `"name"`），也可以是层级路径（如 `"layer1.item1"`），用于访问嵌套的 Layer 中的内容。

**属性：**
- `to` 路径字符串，指向要引用的目标节点。可以是简单的标识符，也可以是层级路径（用 `.` 分隔）

### Expression

表达式用于计算并返回一个值。`evaluate` 会根据表达式的类型和运算符进行计算，返回计算结果。

支持基本的数值运算（`+`, `-`, `*`, `/`, `%`）、比较运算（`>`, `<`, `>=`, `<=`, `==`, `!=`）、逻辑运算（`and`, `or`, `not`）和字符串拼接（`+`）。

**属性：**
- `op` 运算符，如 `+`, `-`, `*`, `/`, `%`, `>`, `<`, `>=`, `<=`, `==`, `!=`, `and`, `or`, `not`, `|`, `match`, `match_mut` 等
- `left` 左操作数（表达式节点）
- `right` 右操作数（表达式节点，对于二元运算符）
- `expr` 可选，是个表达式树，可以用中序表示法（如 `[1, "+", 2]` 或 `["ref", "x"]`）

还有其他可用的 op，在后面描述。
### Call

用于调用函数，可以是内置函数或 module 中定义的函数。
`evaluate` 会执行函数调用，传入参数，并返回函数的返回值。
返回值类型取决于被调用的函数。

**属性：**
- `path` 函数路径，可以是内置函数名（如 `"rand_int"`）或 module 路径（如 `"module.functionName"`）
- `args` 参数列表，数组形式，每个元素是一个表达式节点

### Assign

**注意：Assign 不是节点类型，而是一种操作。**

Assign 用于在上下文中创建或修改变量。这些变量是外部不可见的，只有 Layer 的 `prop` 可以访问。

当执行 Assign 操作时，会在当前的执行上下文（ctx）中创建或更新一个变量。这个变量不会出现在生成的 Text 节点中，也不会影响其他 Layer，但可以在当前 Layer 的 `prop` 中被访问和使用。

Assign 通常用于在生成过程中维护状态，例如计数器、临时变量等。

**操作类型：**
- `set` - 设置或创建变量

**set 操作属性：**
- `path` 变量路径，指向要设置的目标变量（可以是层级路径）
- `value` 要赋给变量的值（表达式节点）
### Domain

用于定义数字到字符串的映射关系，方便不同用途的数字之间、数字与文本之间的转换和比较。Domain 不参与 `evaluate`，而是作为类型系统的一部分，用于模式匹配和类型转换。

Domain 将数字范围映射到字符串标识符。当使用数字值查询 Domain 时，会返回对应的字符串标识符。例如，如果 `X(21)` 在 `partA` 的范围内，则 `X(21) == "partA"` 为真。

Domain 通常与 Match 节点配合使用，用于模式匹配和条件判断。

**属性：**
- `name` Domain 的名称，用于引用
- `branch` 分支列表，每个分支定义一个数字范围到字符串的映射

**branch 项属性：**
- `string` 字符串标识符，映射的目标值
- `range` 数字范围，可以是单个数字、数字区间 `[min, max]`，或它们的数组

**对应的 schema示例：**

```json
{
  "type": "domain",
  "name": "X",
  "branch": [
    {
      "string": "partA",
      "range": [
        [3, 34],
        78,
        114
      ]
    },
    {
      "string": "partB",
      "range": 89
    }
  ]
}
```


### Match

用于定义模式匹配器，根据输入值匹配不同的模式并返回对应的结果。Match 不参与 `evaluate`，而是作为类型系统的一部分，用于模式匹配和条件判断。

Match 支持嵌套模式匹配，可以匹配 Domain、Struct 等复杂类型。当使用值调用 Match 时，会按照 `branch` 的顺序检查每个分支的 `req`（要求），如果所有要求都满足，则返回该分支的 `to` 值。

Match 通常与 Domain 节点配合使用，用于实现复杂的条件逻辑和类型转换。

**属性：**
- `name` Match 的名称，用于引用
- `branch` 分支列表，每个分支定义一个匹配模式和对应的返回值

**branch 项属性：**
- `req` 匹配要求列表，每个要求定义需要满足的条件
- `to` 当所有 `req` 都满足时返回的值（节点）

**req 项属性：**
- `domain` 可选，Domain 名称，用于检查值是否属于该 Domain
- `index` 可选，索引位置，用于访问结构体或数组的特定字段。`req` 在数组中的位置对应 match 表达式中参数的位置
- `expr` 可选，表达式，用于更复杂的匹配条件（如 `["eq", 1]` 表示等于 1）

**对应的 schema 示例：**

```json
{
  "type": "match",
  "name": "somematcher",
  "branch": [
    {
      "req": [
        {
          "domain": "Domain1",
          "index": 1,
          "expr": ["eq", 1]
        }
      ],
      "to": {
        "type": "text",
        "text": "balabala"
      }
    },
    {
      "req": [
        {
          "domain": "Domain2",
          "index": 0
        }
      ],
      "to": {
        "type": "ref",
        "to": "anotherItem"
      }
    }
  ]
}
```

#### 使用 Match

在 Expression 中可以通过以下方式使用 Match：

- **`instance.matchfn(args...)`** - 调用 match 函数，返回匹配结果，不改变 `instance` 本身。`matchfn` 可以是变量，也可以是在 Layer 的 `decl` 中声明的 Match 节点名称
- **`instance->matchfn(args...)`** - 调用 match 函数，改变 `instance` 自身，并返回自身
- **`left | right1, right2, right3, ...`** - 使用 `|` 运算符进行 match，`left` 是第一个参数（待匹配的值），`right1` 是 match 名称，`right2`、`right3` 等是第二、第三及之后的函数参数

当调用 match 时，传入的参数会按照位置对应到 Match 节点 `branch` 中 `req` 数组的位置。例如，如果使用 `value | matcherName, arg1, arg2`，则 `value` 对应第一个 `req`，`arg1` 对应第二个 `req`，`arg2` 对应第三个 `req`。

**Expression 中使用 match 的示例：**

使用 `|` 运算符：
```json
{
  "type": "expression",
  "op": "|",
  "left": {
    "type": "ref",
    "to": "value"
  },
  "right": [
    {
      "type": "ref",
      "to": "matcherName"
    },
    {
      "type": "expression",
      "expr": [1]
    },
    {
      "type": "expression",
      "expr": [2]
    }
  ]
}
```

使用 `match` 运算符：
```json
{
  "type": "expression",
  "op": "match",
  "left": {
    "type": "ref",
    "to": "instance"
  },
  "right": {
    "type": "ref",
    "to": "matcherName"
  },
  "args": [
    {"type": "expression", "expr": [1]},
    {"type": "expression", "expr": [2]}
  ]
}
```
