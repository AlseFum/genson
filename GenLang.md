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

使用 `#match` 为开头的行，之后算做一个模式匹配器。模式匹配允许根据输入值选择不同的输出，语法类似 Rust 的 match 表达式。

#### 基本语法

```genlang
#match matchName
    条件1 => 返回值1
    条件2 => 返回值2
    条件3, 条件4 => 返回值3
    _ => 默认值
```

#### 使用示例

```genlang
#match status
    1 => "在线"
    2 => "离线"
    3 => "忙碌"
    _ => "未知"

greeting
    当前状态：#status|status
```

#### 在表达式中使用

模式匹配可以在表达式中使用，使用 `|` 操作符：

```genlang
$value = 2
result
    结果：#[value | status]
```

其中 `value | status` 表示将 `value` 作为第一个参数传递给 `status` 这个 match 函数。

#### 多参数匹配

```genlang
#match complexMatch
    1, "A" => "情况1A"
    1, "B" => "情况1B"
    2, "A" => "情况2A"
    _ => "其他情况"

test
    结果：#[1 | complexMatch, "A"]
```

> **注意**：在使用 `left | right1, right2, right3` 时，`left` 是第一个参数，`right1` 是 match 名称，`right2`、`right3` 才是第二、第三及之后的函数参数。

### 自定义宏

GenLang 支持自定义宏，但需要在解析器层面进行扩展。

#### 宏的作用

宏允许在编译时进行代码转换，可以简化常用模式的编写。

#### 实现方式

自定义宏需要修改 GenLang 的解析器代码（如 Python 实现），在词法分析和语法分析阶段识别和处理宏定义。

#### 示例（概念性）

```genlang
!macro repeat(n, item)
    #*n item

!use repeat(3, greeting)
```

> **注意**：宏功能的具体实现取决于解析器的支持，当前版本可能需要自行扩展解析器代码。

### 数域枚举

数域枚举（Domain）用于定义数字范围与字符串值的映射关系，可以加速数字与字符串之间的比较和转换。

#### 基本语法

```genlang
#domain domainName
    1 = "red"
    2 = "green"
    3 = "blue"
    4-255 = "unknown"
```

#### 使用示例

```genlang
#domain Color
    1 = "red"
    2 = "green"
    3 = "blue"
    4-10 = "other"
    11-255 = "unknown"

$colorCode = 2
description
    颜色代码 $colorCode 对应 #[colorCode | Color]
```

输出：`颜色代码 2 对应 green`

#### 范围定义

- 单个值：`1 = "value"`
- 范围值：`4-255 = "value"`（包含两端）
- 字符串匹配：当与字符串比较时，会自动匹配对应的枚举值

#### 域变换

除了基本的映射，Domain 还支持数字的固有操作（如 `add`、`sub`）和自定义变换，用于在域内进行数值变换。
### 首行作用（#before）

使用 `#before` 可以在进入生成器时立即执行一些初始化操作，这些操作会在随机选择分支之前完成。

#### 基本语法

```genlang
MyItem
    #before
        $a = 4
        $b = 5
        $c = $a + $b
    #[$a + $c]
    None
```

#### 执行顺序

1. 进入 `MyItem` 时，首先执行 `#before` 块中的所有操作
2. 然后计算概率，随机选择分支
3. 最后执行选中的分支

#### 使用场景

- 初始化变量
- 计算中间值
- 设置上下文状态
- 执行副作用操作

> **注意**：`#` 开头的都有特殊作用，`#before` 会在进入生成器时立刻执行，之后再计算概率进入分支。

### 函数

GenLang 中的函数通过 Module 机制实现。Module 是环境提供的包，包含因环境而异的函数。

#### 调用外部函数

```genlang
result
    随机数：#[randint(1, 100)]
    当前时间：#[now()]
    字符串长度：#[len("hello")]
```

#### Module 的作用

- Module 提供了与运行环境交互的接口
- 不同环境（浏览器、Node.js、Python 等）可以提供不同的 Module 实现
- 常见的 Module 函数包括：数学运算、字符串处理、时间日期、随机数生成等

#### 自定义 Module

自定义 Module 需要在运行时环境中注册，GenLang 语言本身不提供定义 Module 的语法。

### #prop

`#prop` 用于给生成器定义挂载的属性，这些属性可以被外界访问，类似于对象的属性。

#### 基本语法

```genlang
MyGenerator
    #prop
        $name = "示例生成器"
        $version = 1.0
        $author = "开发者"
    value1
    value2
```

#### 访问属性

```genlang
example
    生成器名称：#MyGenerator.name
    版本号：#MyGenerator.version
```

`#prop` 定义的属性在生成器外部可见，可以用于元数据、配置信息等场景。

### #domain

`#domain` 用于定义数域枚举，详见上面的"数域枚举"部分。

## GenLangSchema (Genson)

GenLang 源代码会被编译成 GenLangSchema（简称 Genson），这是一种基于 JSON 的抽象语法树（AST）表示。

### 什么是 Genson

- Genson 是 GenLang 的中间表示形式
- 每个 Genson 文件是一棵 JSON 格式的抽象语法树
- 根节点必须是 `Module` 类型
- 每个节点都是一个对象，必须包含 `type` 属性用于区分节点类型

### 节点类型

Genson 支持以下节点类型：

- **Text** - 文本节点，表示最终输出的文本
- **Sequence** - 序列节点，按顺序执行多个子节点
- **Option** - 选项节点，随机选择一个子节点
- **Roulette** - 轮盘节点，带权重的随机选择
- **Repetition** - 重复节点，重复执行固定次数
- **Delegate** - 委托节点，根据表达式动态重复
- **Layer** - 层节点，创建新的作用域
- **Module** - 模块节点，根节点
- **Var** - 变量节点，声明变量
- **Vec** - 向量节点，数组访问
- **Ref** - 引用节点，引用其他生成器
- **Expression** - 表达式节点，计算表达式
- **Call** - 调用节点，调用函数或 match
- **Set** - 赋值节点，修改变量值
- **Domain** - 域节点，数域枚举定义
- **Match** - 匹配节点，模式匹配定义

### 使用 Genson

Genson 文件可以直接被运行时引擎执行，无需重新编译。这使得：

- 可以在不同语言中实现运行时引擎
- 可以序列化和传输生成逻辑
- 可以动态加载和组合生成器

详细的 Genson 规范请参考 `Genson.md` 文档。

## 完整示例

以下是一个完整的 GenLang 示例，展示了多种特性的组合使用：

```genlang
// 定义颜色域
#domain Color
    1 = "红色"
    2 = "绿色"
    3 = "蓝色"
    4-10 = "其他颜色"

// 定义状态匹配
#match Status
    1 => "在线"
    2 => "离线"
    3 => "忙碌"
    _ => "未知"

// 变量声明
$playerName : str
$playerLevel : num
$playerColor : num = 2

// 生成器定义
playerInfo
    #before
        $playerName = #name
        $playerLevel = #[randint(1, 100)]
    #prop
        $version = "1.0.0"
    Player: $playerName
    Level: $playerLevel
    Status: #[1 | Status]
    Color: #[$playerColor | Color]

name
    Alice
    Bob
    Charlie
    ^2 David  // David 有双倍权重

greeting
    Hello #(world|human|friend)!
    #playerInfo
    Welcome to the game!
```

## 最佳实践

### 1. 变量作用域

- 在需要的地方声明变量，避免全局污染
- 使用 `#before` 进行局部初始化
- 利用 Layer 创建独立的作用域

### 2. 性能优化

- 使用 Domain 加速数字到字符串的转换
- 避免过深的递归引用
- 合理使用权重，避免不必要的计算

### 3. 代码组织

- 将相关的生成器分组
- 使用注释说明复杂逻辑
- 利用内部项（子层）封装局部逻辑

### 4. 错误处理

- 避免无限递归（系统会自动检测并报错）
- 检查数组边界（使用 `else` 处理越界）
- 为可选内容提供默认值

### 5. 可维护性

- 使用有意义的生成器名称
- 将复杂逻辑拆分为多个小生成器
- 利用 `#prop` 添加元数据

## 错误处理

### 递归深度限制

系统会自动检测递归深度，超过限制时会终止并报错：

```genlang
// 错误示例：无限递归
sentence
    #sentence and more
    // 缺少终止条件
```

### 数组越界

访问数组时可以使用 `else` 处理越界情况：

```genlang
$items = ["a", "b", "c"]
safeAccess
    $items[10] else "默认值"
```

### 未定义引用

引用不存在的生成器时，行为取决于实现，通常会返回空字符串或报错。

### 类型错误

表达式中的类型不匹配可能导致运行时错误，建议在使用前进行类型检查。

## 总结

GenLang 是一个简洁而强大的文本生成语言，通过：

- **简洁的语法**：使用缩进和特殊字符，减少样板代码
- **灵活的随机性**：支持权重、动态控制、模式匹配
- **强大的表达式**：支持数值运算、逻辑判断、字符串操作
- **模块化设计**：通过引用、变量、作用域实现代码复用
- **可扩展性**：通过 Module 和宏机制扩展功能

GenLang 源代码会被编译成 Genson（JSON AST），可以在不同语言的运行时中执行，实现了语言与实现的分离。