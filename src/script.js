// flowベースでの書き換えをする実験～～

'use strict';
let all; // 全体
let palette; // カラーパレット

let parallelFunc = [funcP0, funcP1, funcP2, funcP3, funcP4, funcP5, funcP6, funcP7, funcP8];
let normalFunc = [funcN0, funcN1];

const PATTERN_NUM = 10;
const COLOR_NUM = 7;

const DIRECT = 0; // orientedFlowの位置指定、直接指定。
const DIFF = 1 // 差分指定。

const IDLE = 0;
const IN_PROGRESS = 1;
const COMPLETED = 2;

function setup(){
  createCanvas(600, 600);
  // palette HSBでやってみたい
  colorMode(HSB, 100);
  palette = [color(0, 100, 100), color(10, 100, 100), color(17, 100, 100), color(35, 100, 100), color(52, 100, 100), color(64, 100, 100), color(80, 100, 100)];
  all = new entity();
  all.initialize();
  //console.log(palette);
}

function draw(){
  background(63, 20, 100);
  all.update(); // updateする
  all.initialGimicAction();  // 初期化前ギミックチェック
  all.completeGimicAction(); // 完了時ギミックチェック
  all.draw();
  push();
  fill('red');
  rect(0, 0, 40, 40);
  fill('blue')
  rect(0, 40, 40, 40);
  fill(0);
  text('stop', 10, 20);
  text('start', 10, 60);
  pop();
}
// updateしてからGimicをチェックすると、例えばこういうことが起きる。
// まず、completeGimicでinActivateするやつを作ると、それを踏んだactorの動きが止まる。
// インターバルの後、それを解放する何かしらのGimicが発動したとすると、その優先度が最後（後ろの方に配置する）なら、
// そのあとすぐupdateに行くから解放される。これが逆だと、解放した直後に再びGimicが発動して
// 動きが止まってしまうので、配置順がすごく大事。

// バリエーションチェンジ
function mouseClicked(){
  if(mouseX < 40 && mouseY < 80){
    if(mouseY < 40){ noLoop(); }
    else{ loop(); }
    return;
  }
  let newIndex = (all.patternIndex + 1) % PATTERN_NUM;
  all.switchPattern(newIndex);
}

// 簡単なものでいいです（簡単になりすぎ）
class counter{
  constructor(){
    this.cnt = 0;
  }
  getCnt(){ return this.cnt; }
  reset(){ this.cnt = 0; }
  step(diff = 1){
    this.cnt += diff; // カウンターはマイナスでもいいんだよ
    return false; // 統一性
  }
} // limitは廃止（使う側が何とかしろ）（てかもうクラスにする意味ないやんな）

class loopCounter extends counter{ // ぐるぐるまわる
  constructor(period){ // periodは正にしてね
    super();
    this.period = period;
  }
  step(diff = 1){
    this.cnt += diff;
    if(this.cnt > this.period){ this.cnt -= this.period; return true; }
    return false; // 周回時にtrueを返す（何か処理したいときにどうぞ）
  }
}
class reverseCounter extends counter{ // いったりきたり
  constructor(interval){
    super();
    this.interval = interval;
    this.signature = 1; // 符号
  }
  step(diff = 1){
    // diffは常に正オッケーです。
    this.cnt += diff * this.signature;
    if(this.cnt > this.interval){
      this.cnt = 2 * this.interval - this.cnt;
      this.signature *= -1;
      return true;
    }else if(this.cnt < 0){
      this.cnt = -this.cnt;
      this.signature *= -1;
      return true;
    }
    return false; // 折り返すときにtrueを返す
  }
}

// 全部フロー。ただし複雑なconvertはハブにおまかせ～色とかいじれるといいね。今位置情報しかいじってない・・
class flow{
  constructor(){
    this.index = flow.index++;
    this.convertList = []; // 次のflowのリスト
    this.nextFlowIndex = -1; // デフォルトは-1, ランダムの意味
  }
  initialize(_actor){} // stateを送らせるのはactor.
  execute(_actor){
    _actor.setState(COMPLETED) // デフォルトはstateをCOMPLETEDにするだけ。こっちはタイミング決めるのはflowですから。
  }
  convert(_actor){
    //_actor.setState(IDLE); // IDLEにするのはactor.
    if(this.convertList.length === 0){
      _actor.setFlow(undefined);
      _actor.inActivate(); // 次のフローがなければすることはないです。止まります。再びあれするならflowをsetしてね。
      return;
    }
    if(this.nextFlowIndex < 0){ // -1はランダムフラグ
      _actor.setFlow(this.convertList[randomInt(this.convertList.length)]);
    }else{
      _actor.setFlow(this.convertList[this.nextFlowIndex]);
    } // 次のflowが与えられるならそのままisActive継続、次の処理へ。
    // わざとこのあとinActivateにして特定の条件下でactivateさせても面白そう。
  }
  display(gr){} // 一応書いておかないと不都合が生じそうだ
}

class waitFlow extends flow{
  // ただ単に一定数カウントを進めるだけ。いわゆるアイドリングってやつね。
  constructor(span){
    super();
    this.span = span; // どれくらい進めるか
  }
  initialize(_actor){ _actor.timer.reset(); }
  execute(_actor){
    _actor.timer.step(1);
    //console.log(_actor.timer.getCnt());
    if(_actor.timer.getCnt() >= this.span){ _actor.setState(COMPLETED); } // limitって書いちゃった
  }
  // これの派生で、たとえば_actor.setState(COMPLETED)の前くらいに、
  // 「キューの先頭のidをもつactorについてごにょごにょ」
  // とか書いて、デフォルトは何もしない、にすれば、たとえばそのidをもつactorをactivateするとか、
  // スピードが上がってるのを戻すとか、色々指示をとっかえひっかえしてできる。
  // で、使い方としてはそのキューにidぶちこんでcombat走らせるだけだから簡単。
  // spanで効果時間をいじれるし、combatのスピードを調節すれば効果時間をいじることも・・（未定）
}

// hubです。位置情報とかは基本なし（あることもある）。複雑なflowの接続を一手に引き受けます。
class assembleHub extends flow{
  // いくつか集まったら解放される。
  constructor(limit){
    super();
    this.limit = limit;
    this.volume = 0; // lim-1→limのときtrue, 1→0のときfalse.
    this.open = false; // 出口が開いてるかどうかのフラグ
  }
  initialize(_actor){
    this.volume++; // これだけ。
    if(this.volume >= this.limit){ this.open = true; } // limitに達したら開くよ
  }
  execute(_actor){
    if(this.open){
      _actor.setState(COMPLETED);
      this.volume--; // 出て行ったら減らす
      if(this.volume === 0){ this.open = false; } // 0になったタイミングで閉じる
    } // 開いてるなら行って良し
  }
}

class assembleRotaryHub extends assembleHub{
  // アセンブルハブで、かつcloseのたびに行先が変わる。MassGameなどで重宝する。
  constructor(limit){
    super(limit);
    // -1から始まって0, 1, 2, ..., n-1, 0って感じで。
  }
  execute(_actor){
    if(this.open){
      _actor.setState(COMPLETED);
      this.volume--; // 出て行ったら減らす
      if(this.volume === 0){
        this.nextFlowIndex = (this.nextFlowIndex + 1) % this.convertList.length; // この一行のみ追加。
        this.open = false;
      } // 閉じるタイミングで行先を変える
    } // 開いてるなら行って良し
  }
}

class killHub extends flow{
  // 殺すだけ
  constructor(){ super(); }
  execute(_actor){ _actor.kill(); } // おわり。ギミック処理もできるけどflowにすればvisualも定められるし（位置情報が必要）
} // 位置やビジュアルを設けるかどうかは個別のプログラムに任せましょう

class colorSortHub extends flow{
  // 特定の色を1に、それ以外を0に。convertListは0と1のふたつであることを想定している。targetを1に振り分ける。
  constructor(targetColor){
    super();
    this.targetColor = targetColor;
  }
  convert(_actor){
    if(_actor.visual.colorId === this.targetColor){
      this.nextFlowIndex = 1;
    }else{
      this.nextFlowIndex = 0;
    }
    _actor.setFlow(this.convertList[this.nextFlowIndex]); // 然るべくconvert. おわり。
  }
} // そのうち別プロジェクトでやるつもり。

class gateHub extends flow{
  // gateHubはforLoopを模式化したもので、そこを何回も訪れたactorに別の行先を提供するもの。
  constructor(norma){
    super();
    this.norma = norma; // 必要周回数
    this.register = []; // 周回数を記録する登録用の配列
  }
  getIndex(actorId){
    // actorIdのactorが登録されているか調べてそのindexを返す、登録されてない時は-1を返す。
    let index = -1;
    for(let i = 0; i < this.register.length; i++){
      if(this.register[i]['id'] === actorId){ index = i; break; }
    }
    return index;
  }
  convert(_actor){
    // normaに満たない時は0に、満たすときは1に流す。
    let index = this.getIndex(_actor.index);
    if(index < 0){
      let dict = {id:_actor.index, loopCount:0};
      this.register.push(dict); // リストにない時は新規登録
      index = this.register.length - 1; // indexをそのactorの存在番号で更新
    }else{
      this.register[index]['loopCount'] += 1; // リストにあるときは周回数を増やす
    }
    if(this.register[index]['loopCount'] < this.norma){
      this.nextFlowIndex = 0;
    }else{
      this.nextFlowIndex = 1;
      // ここにリストからの削除命令
      this.register.splice(index, 1);
    }
    _actor.setFlow(this.convertList[this.nextFlowIndex]);
  }
}

// うぁぁ時間無駄にしたショック大きすぎて立ち直れない・・・・・・・・・
class standardRegenerateHub extends flow{
  // これを通すと色とか形とかスピードとかもろもろ変化する感じ。
  constructor(newColorId = -1, newSpeed = -1, newFigureId = 0, newSizeFactor = 0.8){
    super();
    this.newColorId = newColorId;
    this.newSpeed = newSpeed;
    this.newFigureId = newFigureId;
    this.newSizeFactor = newSizeFactor;
  }
  execute(_actor){
    // -1のときはランダム
    let colorId = (this.newColorId < 0 ? randomInt(7) : this.newColorId);
    let speed = (this.newSpeed < 0 ? 2 + random(2) : this.newSpeed);
    let figureId = this.newFigureId;
    let sizeFactor = this.sizeFactor;
    _actor.setVisual(colorId, figureId, sizeFactor); // あああspeedじゃないいいいいいい
    _actor.setSpeed(speed);
    _actor.visual.colorId = colorId; // カラーインデックスを更新
    _actor.activate(); // non-Activeになってるのを想定してもいる
    _actor.show(); // 消えてるなら姿を現す
    _actor.setState(COMPLETED); // ここ"COMPLETED"にしてた信じられない
  }
}
// standard. これの他に、サイズとか形とかランダムのやつ作るつもり。とりあえずこれは形とサイズ固定。
// colorIdでなくcolorを取るようにして移動してる間に特定のcolorめがけてグラデするとかそういうのをね・・
// posもcolorもactorによってそれを変化させるコンポジションの一部でしかないらしいよ

class rotaryHub extends flow{
  // actorが通過するたびに最初0, 次1, ...とローテーションで変化する
  constructor(){
    super();
    this.nextFlowIndex = 0; // 次の行先は存在していて0から順に増えていって巡回する
  }
  convert(_actor){
    _actor.setFlow(this.convertList[this.nextFlowIndex]);
    this.nextFlowIndex = (this.nextFlowIndex + 1) % this.convertList.length;
  }
}

// generateHubは特定のフローに・・あーどうしよかな。んー。。
// こういうの、なんか別の概念が必要な気がする。convertしないからさ。違うでしょって話。

// 始点と終点とspanからなりどこかからどこかへ行くことが目的のFlow.
// 対象はmovingActorを想定しているのでposとか持ってないとエラーになります。
class orbitalFlow extends flow{
  constructor(from, to){
    super();
    this.from = from; // スタートの位置ベクトル
    this.to = to; // ゴールの位置ベクトル
    this.span;
  }
  getSpan(){ return this.span; }
  initialize(_actor){
    _actor.setPos(this.from.x, this.from.y); // 初期位置与える、基本これでactorの位置いじってる、今は。
    _actor.timer.reset(); // あ、resetでいいの・・
  }
  getProgress(_actor, diff){ // 進捗状況を取得（0~1）
    _actor.timer.step(diff); // 進める～
    let cnt = _actor.timer.getCnt(); // カウントゲットする～
    if(cnt >= this.span){
      cnt = this.span;
      _actor.setState(COMPLETED); // 処理終了のお知らせ
    }
    return cnt / this.span; // 進捗報告(％)
  }
}

class jumpFlow extends orbitalFlow{
  // ジャンプするやつ
  constructor(from, to){
    super(from, to);
    this.span = p5.Vector.dist(from, to);
  }
  execute(_actor){
    let progress = this.getProgress(_actor, _actor.speed);
    let newX = map(progress, 0, 1, this.from.x, this.to.x);
    let newY = map(progress, 0, 1, this.from.y, this.to.y) - 2 * this.span * progress * (1 - progress);
    _actor.setPos(newX, newY);
  }
}

class straightFlow extends orbitalFlow{
  constructor(from, to, factor){
    super(from, to);
    this.span = p5.Vector.dist(from, to);
    this.factor = factor; // 2なら2倍速とかそういう。
  }
  execute(_actor){
    // 直線
    let progress = this.getProgress(_actor, _actor.speed * this.factor); // 速くなったり遅くなったり
    _actor.setPos(map(progress, 0, 1, this.from.x, this.to.x), map(progress, 0, 1, this.from.y, this.to.y));
  }
  display(gr){
    // 線を引くだけです（ビジュアル要らないならなんかオプション付けてね・・あるいは、んー）
    gr.push();
    gr.strokeWeight(1.0);
    gr.line(this.from.x, this.from.y, this.to.x, this.to.y);
    gr.translate(this.from.x, this.from.y); // 矢印の根元に行って
    let directionVector = createVector(this.to.x - this.from.x, this.to.y - this.from.y);
    gr.rotate(directionVector.heading()); // ぐるんってやって行先をx軸正方向に置いて
    let arrowSize = 7;
    gr.translate(this.span - arrowSize, 0);
    gr.fill(0);
    gr.triangle(0, arrowSize / 2, 0, -arrowSize / 2, arrowSize, 0);
    gr.pop();
  }
}

// ejectiveFlowにしよ

// actorを画面外にふっとばす。ふっとばし方によりいろいろ。
class ejectiveFlow extends flow{
  constructor(){ super(); }
  initialize(_actor){
    _actor.timer.reset(); // resetするだけ
  }
  static eject(_actor){
    // 画面外に出たら抹殺
    if(_actor.pos.x > width || _actor.pos.x < 0 || _actor.pos.y < 0 || _actor.pos.y > height){
      _actor.setState(COMPLETED);
      _actor.hide(); // 姿を消す
    }
  }
}

// 放物線を描きながら画面外に消えていく。物理、すごい・・
class fallFlow extends ejectiveFlow{
  constructor(speed, distance, maxHeight){ // 速さ、水平最高点到達距離、垂直最高点到達距離
    super();
    this.vx = speed; // 水平初速度
    this.vy = 2 * abs(speed) * maxHeight / distance; // 垂直初速度
    this.gravity = 2 * pow(speed / distance, 2) * maxHeight; // 重力加速度
  }
  execute(_actor){
    _actor.timer.step(); // カウントは1ずつ増やす
    let cnt = _actor.timer.getCnt();
    _actor.pos.x += this.vx;
    _actor.pos.y -= this.vy - this.gravity * cnt; // これでいいね。物理。
    ejectiveFlow.eject(_actor);
  }
}

// 直線的に動きながら消滅
class shootingFlow extends ejectiveFlow{
  constructor(v){
    super();
    this.v = v; // 大きさ正規化しないほうが楽しいからこれでいいや
  }
  execute(_actor){
    _actor.pos.x += this.v.x * _actor.speed; // ベクトルvの方向にとんでいく。
    _actor.pos.y += this.v.y * _actor.speed;
    ejectiveFlow.eject(_actor);
  }
}
// ejectiveはあと獣人いいよねじゃなくて螺旋を描きながら上に向かっていく。
// 画面外に出た後の処理も同じ？

// やっと本題に入れる。2時間もかかったよ。
// ratioが1より大きい時はずれ幅を直接長さで指定できるようにしたら面白そうね
class easingFlow extends flow{
  constructor(easeId_parallel, easeId_normal, ratio, spanTime){
    super();
    this.easeId_parallel = easeId_parallel;
    this.easeId_normal = easeId_normal;
    this.ratio = ratio // 垂直イージングの限界の距離に対する幅。
    this.spanTime = spanTime; // 所要フレーム数（デフォルトはやめた）
    // fromとかtoとかdiffVectorはactorごとに管理することにした。
    // あるいはbulletクラスを用意してそういうの持ってるようにすれば辞書要らないけどな
  }
  calcDiffVector(fromVector, toVector){ // 引数にしてしまおう
    let diffVector;
    if(this.ratio < 10){
      // 始点から終点へ向かうベクトルに比率を掛ける
      diffVector = createVector(toVector.y - fromVector.y, -(toVector.x - fromVector.x)).mult(this.ratio);
    }else{
      // 10以上の時は単位法線ベクトルにratioを掛ける
      let normalVector = createVector(toVector.y - fromVector.y, -(toVector.x - fromVector.x)).normalize();
      diffVector = normalVector.mult(this.ratio);
    }
    return diffVector;
  }
  getProgress(_actor){
    _actor.timer.step(); // 1ずつ増やす
    let cnt = _actor.timer.getCnt();
    if(cnt >= this.spanTime){ return 1; } // 1を返す
    return cnt / this.spanTime; // 1を返すときcompleteになるよう修正
  }
}
// 気付いたけど移動ってcntの進め方がすべてだからcntをキー操作でできるようにしたらそれで終わりなんじゃ・・？

// fromもtoもdiffVectorもこっちもち
// こっちはばりばりのorbitalFlowにイージングかけてる従来の形のflowなのです。
// だから根本的にあっちとは性質が異なるわけです。flowの情報だけで位置がすべて出るので。
// あっちはactorに依存しているがゆえに辞書とか必要なわけで。
class orbitalEasingFlow extends easingFlow{
  constructor(easeId_parallel, easeId_normal, ratio, spanTime, from, to){
    super(easeId_parallel, easeId_normal, ratio, spanTime)
    this.from = from;
    this.to = to; // fromとtoがベクトルで与えられる最も一般的な形
    this.diffVector;
    this.spanTime = spanTime // -1指定一旦やめよう。面倒くさくなってきた。固定でいいよ。
  }
  initialize(_actor){
    _actor.pos.set(this.from.x, this.from.y); // orbitalなので初期位置を設定
    this.diffVector = this.calcDiffVector(this.from, this.to); // fromとtoから計算
    _actor.timer.reset(); // spanTimeは具体的な指定以外禁止にしました（めんどい）
  }
  execute(_actor){
    // これも全く異なる、まあ基本は一緒だけど。
    let progress = this.getProgress(_actor); // 最後の処理のときは1が返る仕組み
    let easedProgress = parallelFunc[this.easeId_parallel](progress);
    let normalDiff = normalFunc[this.easeId_normal](progress);
    _actor.pos.x = map(easedProgress, 0, 1, this.from.x, this.to.x);
    _actor.pos.y = map(easedProgress, 0, 1, this.from.y, this.to.y);
    let easeVectorN = p5.Vector.mult(this.diffVector, normalDiff);
    _actor.pos.add(easeVectorN);
    if(progress === 1){
      _actor.setState(COMPLETED); // 1なら処理終了
    }
  }
}

// あー・・両方一緒だ。
// Gimicが要らないとは言ってない。使い方が間違ってるってだけ。

// 名前muzzleにしよう
// mode増やそう。revolveのモード。simple, rect, ellipse, fan, rotation, parallelの6種類
class orientedMuzzle extends easingFlow{
  constructor(easeId_parallel, easeId_normal, ratio, spanTime, kind, infoVectorArray, mode){
    super(easeId_parallel, easeId_normal, ratio, spanTime);
    //this.infoVector; // 情報ベクトル
    //this.kind; // toの指定の仕方（DIRECT:位置を直接指定、DIFF:ベクトルで指定）
    this.register = [];
    this.kind = kind; // DIRECTなら目標地点ベース、DIFFならベクトルベース
    this.infoVectorArray = infoVectorArray; // 位置だったりベクトルの集合
    this.currentIndex = -1; // simpleはまず1つ進めてからなので初期値を-1にしておかないと。てかsimpleでしか使わないな・・
    this.revolveMode = mode;
  }
  getInfoVector(){
    // 銃口を回す
    if(this.revolveMode === 0){ // simple. 1つ進める。reverseは配列を鏡写しで2倍にすればいい。([0, 1 ,2, 3, 2, 1]とか)
      this.currentIndex = (this.currentIndex + 1) % this.infoVectorArray.length;
      return this.infoVectorArray[this.currentIndex];
    }else if(this.revolveMode === 1){ // rect.
      // [v0, v1]としてv0(左上)からv1(右下)までの範囲に指定する。DIRECTを想定。
      let leftUp = this.infoVectorArray[0];
      let rightDown = this.infoVectorArray[1];
      let x = leftUp.x + random(rightDown.x - leftUp.x);
      let y = leftUp.y + random(rightDown.y - leftUp.y);
      return createVector(x, y);
    }else if(this.revolveMode === 2){ // ellipse.
      // [v0, v1]としてv0中心、横半径v1[0], 縦半径v1[1]の範囲に指定する。DIRECTを想定。
      let centerVector = this.infoVectorArray[0];
      let sizeVector = this.infoVectorArray[1];
      let r = random(1);
      let theta = random(2 * PI);
      return createVector(centerVector.x + r * sizeVector.x * cos(theta), centerVector.y + r * sizeVector.y * sin(theta));
    }else if(this.revolveMode === 3){ // fan.
      // [v0, v1]としてv0からv1へ時計回りに回すとしてその間のどれかを返す。DIFFを想定。
      let v0 = this.infoVectorArray[0];
      let v1 = this.infoVectorArray[1];
      let theta0 = atan2(v0.y, v0.x);
      let theta1 = (atan2(v1.y, v1.x) + 2 * PI) % (2 * PI);
      let theta = theta0 + random(theta1 - theta0);
      let r = random((v0.mag() + v1.mag()) / 2);
      return createVector(r * cos(theta), r * sin(theta));
    }else if(this.revolveMode === 4){ // rotation.
      // [v0, v1, v2]としてv2は初期値v0で、v1=[r, θ]としてr倍、θ回転したものを作り続ける。
      let v0 = this.infoVectorArray[0];
      let v1 = this.infoVectorArray[1];
      let v2 = this.infoVectorArray[2];
      v2.mult(v1.x);
      let currentTheta = atan2(v2.y, v2.x);
      currentTheta += v1.y;
      v2.rotate(v1.y);
      return v2;
    }else if(this.revolveMode === 5){ // parallel;
      // [v0, v1, v2]としてv2は初期値v0で、v1 = [a, b]としてこれを足したものを作り続ける。
      let v0 = this.infoVectorArray[0];
      let v1 = this.infoVectorArray[1];
      let v2 = this.infoVectorArray[2];
      v2.add(v1);
      return v2;
    }
  }
  regist(_actor){
    // revolverGimicでこれを呼び出して先に登録しちゃう
    let dict = {};
    dict['id'] = _actor.index;
    dict['from'] = _actor.pos;
    let infoVector = this.getInfoVector(); // ベクトルはここで計算する
    if(this.kind === DIRECT){
      dict['to'] = infoVector;
    }else{
      let toVector = p5.Vector.add(_actor.pos, infoVector);
      dict['to'] = toVector;
    }
    dict['diffVector'] = this.calcDiffVector(dict['from'], dict['to']);
    this.register.push(dict);
    // bulletクラス作ればactorから情報引き出せるけど・・
  }
  getIndex(actorId){
    let correctId = -1;
    for(let i = 0; i < this.register.length; i++){
      if(this.register[i]['id'] === actorId){ correctId = i; break; }
    }
    return correctId; // -1:Not Found.
  }
  delete(actorId){
    // 登録情報の削除。COMPLETEDの際に呼び出す
    let correctId = this.getIndex(actorId);
    this.register.splice(correctId, 1);
  }
  initialize(_actor){
    this.regist(_actor); // 登録
    _actor.timer.reset();
  }
  execute(_actor){
    let index = this.getIndex(_actor.index);
    let progress = this.getProgress(_actor); // progressを普通に取得。（-1の指定やめた）
    let easedProgress = parallelFunc[this.easeId_parallel](progress);
    let normalDiff = normalFunc[this.easeId_normal](progress);

    let fromVector = this.register[index]['from'];
    let toVector = this.register[index]['to'];
    let diffVector = this.register[index]['diffVector'];

    _actor.pos.x = map(easedProgress, 0, 1, fromVector.x, toVector.x);
    _actor.pos.y = map(easedProgress, 0, 1, fromVector.y, toVector.y);
    let easeVectorN = p5.Vector.mult(diffVector, normalDiff);
    _actor.pos.add(easeVectorN);
    if(progress === 1){
      _actor.setState(COMPLETED);
      this.delete(_actor.index); // 完了したら情報を削除
    }
  }
}

flow.index = 0; // convertに使うflowの連番

// 純粋なactorはflowをこなすだけ、言われたことをやるだけの存在
class actor{
  constructor(f = undefined){
    // colorIdはそのうち廃止してビジュアルをセッティングするなんかつくる
    this.index = actor.index++;
    this.currentFlow = f; // 名称をcurrentFlowに変更
    this.timer = new counter();
    this.isActive = false; // デフォルトをfalseにしてプログラムのインプット時にtrueにする作戦で行く
    this.state = IDLE; // 状態（IDLE, IN_PROGRESS, COMPLETED）
  }
  activate(){ this.isActive = true; } // isActiveがfalse⇔updateしない。シンプル。これを目指している。
  inActivate(){ this.isActive = false; } // 冗長だけどコードの可読性の為に両方用意する。
  setState(newState){ this.state = newState; } // stateをチェンジ
  setFlow(newFlow){ this.currentFlow = newFlow; } // flowをセットする
  // 再スタートさせるなら、まずflowをセット、次いでactivateという流れになります。
  // flowだけセットしてactivateしなければ待機状態を実現できます。いわゆるポーズ、
  // entityの側でまとめてactivate, inActivateすればまとめて動きを止めることも・・・・
  update(){
    if(!this.isActive){ return; } // activeじゃないなら何もすることはない。
    // initialGimicが入るのはここ
    if(this.state === IDLE){
      this.idleAction();
    }
    if(this.state === IN_PROGRESS){
      this.in_progressAction();
    }else if(this.state === COMPLETED){
      this.completeAction();
    }
    // completeGimicが入るのはここ。
    // IN_PROGRESSのあとすぐにCOMPLETEDにしないことでGimicをはさむ余地を与える.
  }
  idleAction(){
    this.currentFlow.initialize(this); // flowに初期化してもらう
    this.setState(IN_PROGRESS);
  }
  in_progressAction(){
    this.currentFlow.execute(this); // 実行！この中で適切なタイミングでsetState(COMPLETED)してもらうの
  }
  completeAction(){
    this.setState(IDLE);
    this.currentFlow.convert(this); // ここで行先が定められないと[IDLEかつundefined]いわゆるニートになります（おい）
  }
  kill(){
    // 自分を排除する
    let selfId;
    for(selfId = 0; selfId < all.actors.length; selfId++){
      if(all.actors[selfId].index === this.index){ break; }
    }
    all.actors.splice(selfId, 1);
  }
  display(){};
}

// 色や形を与えられたactor. ビジュアル的に分かりやすいので今はこれしか使ってない。
class movingActor extends actor{
  constructor(f = undefined, speed = 1, colorId = 0, figureId = 0, sizeFactor = 0.8){
    super(f);
    this.pos = createVector(-100, -100); // flowが始まれば勝手に・・って感じ。
    this.visual = new rollingFigure(colorId, figureId, sizeFactor); // 回転する図形
    this.speed = speed; // 今の状況だとスピードも要るかな・・クラスとして分離するかは要相談（composition）
    this.visible = true;
  }
  setPos(x, y){ // そのうちゲーム作ってみるとかなったら全部これ経由しないとね。
    this.pos.x = x;
    this.pos.y = y; // 今更だけどposをセットする関数（ほんとに今更）
  }
  getPos(){
    return this.pos; // ゲッター
  }
  setSpeed(newSpeed){
    this.speed = newSpeed;
  }
  // 今ここにsetVisualを作りたい。色id, サイズとか形とか。
  setVisual(newColorId, newFigureId, newSizeFactor){
    this.visual.reset(newColorId, newFigureId, newSizeFactor);
  }
  show(){ this.visible = true; }   // 姿を現す
  hide(){ this.visible = false; }  // 消える
  display(){
    if(!this.visible){ return; }
    this.visual.display(this.pos);
  }
}

// 1つだけflowをこなしたら消える
class combat extends actor{
  constructor(f = undefined){
    super(f);
    // 1ずつ増えるしvisual要らないしって感じ。
  }
  completeAction(){ this.kill(); } // ひとつflowを終えたら消滅
}

actor.index = 0; // 0, 1, 2, 3, ....

// figureクラスは図形の管理を行う
// やることは図形を表示させること、回転はオプションかな・・
// たとえばアイテムとか、オブジェクト的な奴とか。回転しないことも考慮しないとなぁ。
class figure{
  constructor(colorId, figureId = 0, sizeFactor = 0.8){
    this.colorId = colorId; // 0~6の値 // colorにしてグラデいじるのはMassGameの方でやることにしました
    // shootingGameの方でもグラデ使いたいんだけどどうすっかなー、ま、どうにでもできるか。
    // こういうのどうにでもできる強さがあればいいんじゃない？はやいとこ色々作りたいよ。
    this.figureId = figureId; // 図形のタイプ
    this.sizeFactor = sizeFactor; // おおきさ
    this.graphic = createGraphics(40, 40);
    //inputGraphic(this.graphic, colorId);
    figure.setGraphic(this.graphic, colorId, figureId, sizeFactor);
  }
  reset(newColorId, newFigureId, newSizeFactor){
    figure.setGraphic(this.graphic, newColorId, newFigureId, newSizeFactor);
  }
  static setGraphic(img, colorId, figureId = 0, sizeFactor = 0.8){
    img.clear();
    img.noStroke();
    img.fill(palette[colorId]);
    let r = 10 * sizeFactor;
    if(figureId === 0){
      img.rect(20 - r, 20 - r, 2 * r, 2 * r);
    }else if(figureId === 1){
      r *= 1.1;
      img.ellipse(20, 20, 2 * r, 2 * r);
    }else if(figureId === 2){
      r *= 1.2;
      img.triangle(20, 20 - 2 * r / Math.sqrt(3), 20 + r, 20 + (r / Math.sqrt(3)), 20 - r, 20 + (r / Math.sqrt(3)));
    }
  }
  display(pos){
    push();
    translate(pos.x, pos.y);
    image(this.graphic, -20, -20); // 20x20に合わせる
    pop();
  }
}

// というわけでrollingFigure.
class rollingFigure extends figure{
  constructor(colorId, figureId = 0, sizeFactor = 0.8){
    super(colorId, figureId, sizeFactor);
    //this.rotation = random(2 * PI);
    this.rotation = 0; // 0にしよー
  }
  // updateはflowを定めてたとえば小さくなって消えるとか出来るようになるんだけどね（まだ）
  // もしupdateするならactorのupdateに書くことになりそうだけど。
  display(pos){
    push();
    translate(pos.x, pos.y);
    this.rotation += 0.1; // これも本来はfigureのupdateに書かないと・・基本的にupdate→drawの原則は破っちゃいけない
    rotate(this.rotation);
    image(this.graphic, -20, -20); // 20x20に合わせる
    pop();
  }
}

// flowの開始時、終了時に何かさせたいときの処理
// initialはflowのinitializeの直前、completeはflowの完了直後に発動する
class Gimic{
  constructor(myFlowId){
    this.myFlowId = myFlowId; // どこのflowの最初や最後でいたずらするか
  }
  action(_actor){ return; };
  initialCheck(_actor, flowId){
    if(_actor.state === IDLE && _actor.isActive && flowId === this.myFlowId){ return true; }
    return false;
  }
  completeCheck(_actor, flowId){
    if(_actor.state === COMPLETED && _actor.isActive && flowId === this.myFlowId){ return true; }
    return false;
  }
}

// killするだけ.
class killGimic extends Gimic{
  constructor(myFlowId){
    super(myFlowId);
  }
  action(_actor){
    _actor.inActivate();
    _actor.kill();
  }
}

class inActivateGimic extends Gimic{
  constructor(myFlowId){
    super(myFlowId);
  }
  action(_actor){
    _actor.inActivate(); // 踏んだ人をinActivateするだけ
  }
}

class activateGimic extends Gimic{
  constructor(myFlowId, targetActorId){
    super(myFlowId);
    this.targetActorId = targetActorId;
  }
  action(_actor){
    all.getActor(this.targetActorId).activate(); // ターゲットをactivateする
  }
}

// flowに装飾をするのが仕事。
// flowの性質そのものをいじるのが目的ではない。
// myFlowIdはあくまで発動させるflowの場所を指定するだけで、
// これをもとにflowにアクセスして内容をいじるのが目的ではない。
// たとえばボードゲームとかで状態異常発生させるとかワープさせる、そういうことに使うんです、これは。
// 汎用コードだとあんま使い道ないかもね・・

// コードの再利用ができるならこれを複数バージョンに・・って事も出来るんだけどね

// Colosseoっていう、いわゆる紅白戦みたいなやつ作りたいんだけど。なんか、互いに殺しあってどっちが勝つとか。
// HP設定しといて、攻撃と防御作って、色々。その時にこれで、
// 攻撃や防御UP,DOWN, HP増減、回復、色々。まあ回復はHub..HubにGimic配置してもいいし。
// そういうのに使えそうね。
// キャラビジュアルは黒と白のシンプルな奴にして縦棒で目とか付けて一応ディレクション変更で向きが変わるように、
// やられたら目がバッテンになって消えるみたいな
// ダメージの色とか決めて（バー出せたらかっこいいけど）

// flowのupdateとかやりたいわね
// 使い終わったactorの再利用とかしても面白そう（他のプログラムでやってね）（trash）
class entity{
  constructor(){
    this.base = createGraphics(width, height);
    this.additive = createGraphics(width, height); // addFlowsで作るやつー
    this.flows = [];
    this.baseFlows = []; // baseのflowの配列
    this.addFlows = [];  // 動かすflowからなる配列    // これをupdateすることでflowを動かしたいんだけど
    this.actors = [];
    this.initialGimic = [];  // flow開始時のギミック
    this.completeGimic = []; // flow終了時のギミック
    this.patternIndex = 9; // うまくいくのかな・・
    this.patternArray = [createPattern0, createPattern1, createPattern2, createPattern3, createPattern4, createPattern5, createPattern6, createPattern7, createPattern8, createPattern9];
  }
  getFlow(givenIndex){
    for(let i = 0; i < this.flows.length; i++){
      if(this.flows[i].index === givenIndex){ return this.flows[i]; break; }
    }
    return undefined; // forEachだとreturnで終わってくれないことを知った
  }
  getActor(givenIndex){
    for(let i = 0; i < this.actors.length; i++){
      if(this.actors[i].index === givenIndex){ return this.actors[i]; break; }
    }
    return undefined;
  }
  initialize(){
    this.patternArray[this.patternIndex]();
    this.baseFlows.forEach(function(f){ f.display(this.base); }, this); // ベースグラフの初期化（addは毎ターン）
  }
  reset(){
    this.base.clear();
    this.additive.clear();
    this.flows = [];
    this.baseFlows = []; // baseのflowの配列
    this.addFlows = [];  // 動かすflowからなる配列
    this.actors = [];
    flow.index = 0; // 通し番号リセット
    actor.index = 0;
    this.initialGimic = [];
    this.completeGimic = [];
  }
  activateAll(){ // まとめてactivate.
    this.actors.forEach(function(_actor){ _actor.activate(); }, this);
    // 一部だけしたくないならこの後個別にinActivateするとか？
  }
  switchPattern(newIndex){
    this.reset();
    this.patternIndex = newIndex;
    this.initialize(); // これだけか。まぁhub無くなったしな。
  }
  registActor(flowIds, speeds, colorIds){
    // flowはメソッドでidから取得。
    for(let i = 0; i < flowIds.length; i++){
      let f = this.getFlow(flowIds[i]);
      let newActor = new movingActor(f, speeds[i], colorIds[i])
      this.actors.push(newActor);
    }
  }
  registDetailedActor(flowIds, speeds, colorIds, figureIds, sizeIds){
    // 個別に形とか大きさとか指定する
    for(let i = 0; i < flowIds.length; i++){
      let f = this.getFlow(flowIds[i]);
      let newActor = new movingActor(f, speeds[i], colorIds[i], figureIds[i], sizeIds[i]);
      this.actors.push(newActor);
    }
  }
  registFlow(paramSet, flag = true){
    // paramSetはパラメータの辞書(params)の配列
    paramSet.forEach(function(params){
      let newFlow = entity.createFlow(params);
      this.flows.push(newFlow);
      if(flag){
        this.baseFlows.push(newFlow);
      }else{
        this.addFlows.push(newFlow);
      }
    }, this);
  }
  connect(index, nextIndexList){
    // index番のflowの行先リストをnextIndexListによって作る
    nextIndexList.forEach(function(nextIndex){
      this.getFlow(index).convertList.push(this.getFlow(nextIndex));
    }, this)
  }
  connectMulti(indexList, nextIndexListArray){
    // IndexListに書かれたindexのflowにまとめて指定する
    // たとえば[6, 7, 8], [[2], [3], [4, 5]] ってやると6に2, 7に3, 8に4, 5が指定される
    for(let i = 0; i < indexList.length; i++){
      this.connect(indexList[i], nextIndexListArray[i]);
    }
  }
  static createFlow(params){
    if(params['type'] === 'straight'){
      return new straightFlow(params['from'], params['to'], params['factor']);
    }else if(params['type'] === 'jump'){
      return new jumpFlow(params['from'], params['to']);
    }else if(params['type'] === 'assemble'){
      return new assembleHub(params['limit']);
    }else if(params['type'] === 'fall'){
      return new fallFlow(params['speed'], params['distance'], params['height']);
    }else if(params['type'] === 'shooting'){
      return new shootingFlow(params['v']); // fromは廃止
    }else if(params['type'] === 'wait'){
      return new waitFlow(params['span']); // spanフレーム数だけアイドリング。combatに使うなど用途色々
    }else if(params['type'] === 'colorSort'){
      return new colorSortHub(params['targetColor']); // targetColorだけ設定
    }else if(params['type'] === 'orbitalEasing'){
      return new orbitalEasingFlow(params['easeId1'], params['easeId2'], params['ratio'], params['spanTime'], params['from'], params['to']);
    }else if(params['type'] === 'orientedMuzzle'){
      return new orientedMuzzle(params['easeId1'], params['easeId2'], params['ratio'], params['spanTime'], params['kind'], params['infoVectorArray'], params['mode']);
    }else if(params['type'] === 'vector'){
      return new vectorFlow(params['easeId1'], params['easeId2'], params['ratio'], params['spanTime'], params['directionVector']);
    }
  }
  initialGimicAction(){
    if(this.initialGimic.length === 0){ return; }
    this.initialGimic.forEach(function(g){
      this.actors.forEach(function(a){
        if(a.currentFlow === undefined){ return; }
        if(g.initialCheck(a, a.currentFlow.index)){ g.action(a); }
      })
    }, this)
  }
  completeGimicAction(){
    if(this.completeGimic.length === 0){ return; }
    this.completeGimic.forEach(function(g){
      this.actors.forEach(function(a){ // forEachの場合のcontinueは「return」だそうです（関数処理だから）
        if(a.currentFlow === undefined){ return; }
        if(g.completeCheck(a, a.currentFlow.index)){ g.action(a); }
      })
    }, this)
  }
  update(){
    this.actors.forEach(function(_actor){
      //console.log(_actor);
      _actor.update(); // flowもupdateしたいんだけどね
    }) // addFlowsを毎フレームupdateできないか考えてみる。なんなら新しくクラス作るとか。activeFlow（？？？）
  }
  draw(){
    image(this.base, 0, 0);
    if(this.addFlows.length > 0){ // 付加的な要素は毎フレーム描画し直す感じで
      this.additive.clear();
      this.addFlows.forEach(function(f){ f.display(this.additive); })
      image(this.additive, 0, 0); // 忘れてた、これ無かったら描画されないじゃん
    }
    this.actors.forEach(function(_actor){ // actorの描画
      _actor.display();
    })
  }
}

// --------------------------------------------------------------------------------------- //

// ここでmain→subの順にregistすればOK
function createPattern0(){
  // 作ってみるか・・・（どきどき）
  let vecs = getVector([100, 100, 300, 300], [100, 300, 300, 100]);
  let paramSet = getOrbitalFlow(vecs, [0, 1, 2, 3], [1, 2, 3, 0], 'straight');
  all.registFlow(paramSet);
  all.registFlow([{type:'wait', span:120}]); // waitFlowをさっそくつかってみよう→成功～いろいろ使えそう。
  all.connectMulti([0, 1, 2, 3, 4], [[1], [4], [3], [0], [2]]);
  all.registActor([0], [2], [0]);
  all.activateAll();
  // 3番にkillを放り込んでみる
  //all.initialGimic.push(new killGimic(1)); // うまくいってるみたい
  all.completeGimic.push(new killGimic(3));
}

function createPattern1(){
  // assembleとjumpの実験
  let posX = multiSeq([100, 200, 300], 4);
  let posY = jointSeq([constSeq(100, 3), constSeq(200, 3), constSeq(300, 3), constSeq(400, 3)]);
  let vecs = getVector(posX, posY);
  let paramSet = getOrbitalFlow(vecs, [1, 1, 0, 4, 2, 4, 4, 3, 7, 5, 6, 8], [0, 2, 3, 1, 5, 3, 5, 6, 4, 8, 7, 7], 'straight');
  paramSet.push({type:'assemble', limit: 3});
  all.registFlow(paramSet);
  all.connectMulti([0, 1, 2, 3, 4, 5], [[2], [4], [7], [0, 1], [9], [7]]);
  let additional = getOrbitalFlow(vecs, [6, 10, 8, 9, 11], [9, 7, 11, 10, 10], 'jump');
  all.registFlow(additional);
  all.connectMulti([6, 7, 8, 9, 10, 11, 12], [[9], [10, 13], [12], [11, 15], [8], [8], [3, 5, 6]]);
  all.connectMulti([13, 14, 15, 16, 17], [[16], [8], [17], [14], [14]]);
  all.registActor([3, 5, 6], [2, 2, 2], [0, 1, 2]);
  all.activateAll();
}
// generateHubとkillHub作りたい
// 色に合わせてconvertも作りたいけど明日にしよ
function createPattern2(){
  // shootingの実験
  let posX = [60].concat(constSeq(120, 5)).concat(constSeq(180, 5)).concat([240, 300]);
  let posY = [180].concat(arSeq(60, 60, 5)).concat(arSeq(60, 60, 5)).concat([180, 180]);
  let vecs = getVector(posX, posY);

  let paramSet = getOrbitalFlow(vecs, [0, 0, 0, 0, 0, 1, 2, 3, 4, 5, 8, 11], [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 'straight');

  all.registFlow(paramSet); // 0～11
  let shootingSet = typeSeq('shooting', 4);
  let vSet = [createVector(1, 1), createVector(1, 1), createVector(1, -1), createVector(1, -1)];

  for(let i = 0; i < 4; i++){ shootingSet[i]['v'] = vSet[i]; }

  let fallSet = typeSeq('fall', 3);
  let dataSet = [[1, 30, 60], [1, 60, 120], [2, 60, 60]];
  for(let i = 0; i < 3; i++){ fallSet[i]['speed'] = dataSet[i][0]; fallSet[i]['distance'] = dataSet[i][1]; fallSet[i]['height'] = dataSet[i][2]; }
  all.registFlow(shootingSet.concat(fallSet)); // 12～18
  // standardRegenerateHubを使ってみよう
  let reg = new standardRegenerateHub();
  all.flows.push(reg);
  all.baseFlows.push(reg); // 19.

  all.connectMulti(arSeq(0, 1, 20), [[5], [6], [7], [8], [9], [12], [13], [10, 16], [14], [15], [11, 17], [18], [19], [19], [19], [19], [19], [19], [19], [0, 1, 2, 3, 4]]);
  //console.log(reg);
  all.registActor([0, 1, 2, 3, 4, 2, 2], [2, 2, 2, 2, 2, 2, 2], [0, 1, 2, 3, 4, 5, 6]);
  all.activateAll();
}

function createPattern3(){
  // generateHubの実験。
  let posX = [160, 120, 200, 80, 160, 240, 40, 120, 200, 280, 80, 160, 240, 120, 200, 160];
  for(let i = 0; i < 16; i++){ posX[i] += 160; }
  let posY = [40, 80, 80, 120, 120, 120, 160, 160, 160, 160, 200, 200, 200, 240, 240, 280];
  let vecs = getVector(posX, posY);

  let paramSet = getOrbitalFlow(vecs, [0, 2, 1, 1, 4, 5, 3, 7, 4, 8, 5, 9, 6, 10, 7, 11, 8, 12, 10, 11, 14, 14, 13, 15], [1, 0, 3, 4, 2, 2, 6, 3, 7, 4, 8, 5, 10, 7, 11, 8, 12, 9, 13, 13, 11, 12, 15, 14], 'straight');
  all.registFlow(paramSet); // 0～23
  all.registFlow([{type:'fall', speed:-2, distance:60, height:60}, {type:'fall', speed:2, distance:60, height:60}]);
  // regenerate.
  let reg = new standardRegenerateHub();
  all.flows.push(reg);
  all.baseFlows.push(reg); // 26.
  all.connectMulti(arSeq(0, 1, 27), [[2, 3], [0], [6], [4, 8], [1], [1], [12, 24], [6], [7, 14], [4, 8], [9, 16], [5, 10], [18, 13], [7, 14], [15, 19], [9, 16], [17], [11, 25], [22], [22], [15, 19], [17], [23], [20, 21], [26], [26], [0, 3, 8, 14, 15, 9, 4, 1]]);
  all.registActor([8, 9, 14, 15, 3, 4, 19, 20], [2, 2, 2, 2, 2, 2, 2, 2], [0, 1, 2, 3, 4, 5, 6, 0]);
  all.activateAll();
  //all.completeGimic.push(new generateGimic(24, [0, 1, 3, 4])); // 24の完了時に0, 1, 3, 4のいずれかに発生させる
}

function createPattern4(){
  // activate, inactivateの実験。
  let posX = [100, 340, 340, 100, 180, 260, 260, 180];
  let posY = [100, 100, 340, 340, 180, 180, 260, 260];
  let vecs = getVector(posX, posY);
  let paramSet = getOrbitalFlow(vecs, [0, 1, 2, 3, 4, 5, 6, 7], [1, 2, 3, 0, 5, 6, 7, 4], 'straight');

  all.registFlow(paramSet);
  all.connectMulti([0, 1, 2, 3, 4, 5, 6, 7], [[1], [2], [3], [0], [5], [6], [7], [4]]);

  all.registActor([0, 4], [1, 3], [0, 1]);
  all.activateAll();

  for(let i = 4; i <= 7; i++){
    all.completeGimic.push(new inActivateGimic(i)); // 4～7は完了時に止まる。
  }
  for(let i = 0; i <= 3; i++){
    all.completeGimic.push(new activateGimic(i, 1)); // 0～3を踏むと1番がactivateされる
  }
}

function createPattern5(){
  // colorSortHubの実験
  let posX = arSeq(60, 40, 8).concat(arSeq(100, 40, 7));
  let posY = constSeq(80, 8).concat(constSeq(160, 7));
  let vecs = getVector(posX, posY);
  let paramSet = getOrbitalFlow(vecs, [0, 1, 2, 3, 4, 5, 6, 1, 2, 3, 4, 5, 6, 7], [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14], 'straight');
  all.registFlow(paramSet);
  // 次にfallFlow
  paramSet = constSeq({type:'fall', speed:2, distance:50, height:50}, 7);
  all.registFlow(paramSet);
  // 次にcolorSortHub
  paramSet = typeSeq('colorSort', 6); // const使うと全部同じになっちゃう
  for(let i = 0; i < 6; i++){ paramSet[i]['targetColor'] = i; } // 0, 1, 2, 3, 4, 5を分けてね
  //console.log(paramSet);
  all.registFlow(paramSet);
  // 次にgenerateModule
  //all.registFlow([{type:'wait', span:30}]); // ここに普通のactorを走らせて、自分とつないでウロボロスにする
  // 次に接続
  let reg = new standardRegenerateHub();
  all.flows.push(reg);
  all.baseFlows.push(reg); // 27.
  all.connectMulti(arSeq(0, 1, 28), [[21], [22], [23], [24], [25], [26], [13], [14], [15], [16], [17], [18], [19], [20], [27], [27], [27], [27], [27], [27], [27], [1, 7], [2, 8], [3, 9], [4, 10], [5, 11], [6, 12], [0]]);
  // 次にgenerateGimic
  //all.completeGimic.push(new generateGimic(27, [0]));
  // 生成用のactor
  //let generateRunner = new actor(all.getFlow(27));
  //generateRunner.activate();
  //all.actors.push(generateRunner); // 走るだけ
  all.registActor([0, 0, 0, 0, 0, 0, 0], [1.4, 1.6, 1.8, 2, 2.2, 2.4, 2.6], arSeq(0, 1, 7));
  all.activateAll();
}
function createPattern6(){
  // 書き直し。まずorbitalEasingFlow.
  let vecs = getVector([100, 200, 300], [100, 100, 100]);
  let paramSet = getOrbitalEasingFlow(vecs, arSeq(1, 1, 2), constSeq(0, 2), constSeq(0.1, 2), constSeq(60, 2), arSeq(0, 1, 2), arSeq(1, 1, 2));
  all.registFlow(paramSet);
  all.connectMulti([0], [[1]]); // 0がひとつめ、1がふたつめ。
  // 追加。
  vecs = getVector([100, -200, -100, -150, -300, -400], [200, -100, -200, -150, 0, 100]);
  paramSet = getOrientedMuzzle(vecs, [7, 8], [1, 0], [0.1, 0.1], [120, 120], [DIFF, DIFF], [[0], [1, 2, 3, 4, 5]], [0, 0]);
  all.registFlow(paramSet); // 2と3.
  // 登録するところまでconstructorに書いてしまえ。そうすればregistFlowの時点ですべて終わる。
  // いろいろごちゃごちゃしてるけどやってることは単純明快です。あっちいけ。そんだけ。
  //all.initialGimic.push(new singleMuzzleRevolver(2, DIFF, vecs[0]));
  //all.initialGimic.push(new multiMuzzleRevolver(3, DIFF, [vecs[1], vecs[2], vecs[3], vecs[4], vecs[5]]));
  // convert忘れてた
  all.connectMulti([1, 2, 3], [[2], [3], [0]]);
  // なんだろ、このconvertまでの一連の流れをもうちょっとメソッド化したいな・・・・
  all.registActor([0, 0, 0, 0, 0], [2, 2, 2, 2, 2], [0, 1, 2, 3, 4]);
  all.activateAll();
}

function createPattern7(){
  // forの実験
  let posX = jointSeq([arSeq(200, 100, 3), arSeq(100, 100, 5), arSeq(200, 100, 3), arSeq(100, 100, 5), arSeq(100, 100, 4)]);
  let posY = jointSeq([constSeq(100, 3), constSeq(200, 5), constSeq(300, 3), constSeq(400, 5), constSeq(500, 4)]);
  let vecs = getVector(posX, posY);
  let paramSet = getOrbitalFlow(vecs, [0, 1, 4, 1, 2, 3, 4, 5, 6, 8, 9, 6, 11, 9, 10, 7, 12, 13, 13, 15, 11, 17, 18, 14, 16, 19], [1, 2, 0, 5, 6, 4, 5, 6, 7, 4, 5, 10, 3, 8, 9, 15, 11, 12, 14, 14, 16, 12, 13, 19, 17, 18], 'straight');
  all.registFlow(paramSet);
  let h1 = new gateHub(3);
  //console.log(h1);
  let h2 = new gateHub(4);
  let h3 = new gateHub(5);
  //console.log(h3);
  all.flows = all.flows.concat([h1, h2, h3]);
  //console.log(all.flows[26]);
  all.baseFlows = all.baseFlows.concat([h1, h2, h3]);
  all.connectMulti(arSeq(0, 1, 29), [[1, 3], [4], [0], [7], [26], [2, 6], [7], [26], [15], [2, 6], [7], [14], [5], [9], [10, 13], [19], [28], [16], [23], [23], [24], [16], [27], [25], [21], [22], [11, 8], [18, 17], [20, 12]]);
  all.registActor([0], [2], [0]);
  all.activateAll();
}
function createPattern8(){
  let posX = multiSeq(arSeq(120, 60, 5), 3).concat([60, 60, 360]);
  let posY = jointSeq([constSeq(60, 5), constSeq(120, 5), constSeq(180, 5)]).concat([120, 240, 240]);
  let vecs = getVector(posX, posY);
  let paramSet = getOrbitalFlow(vecs, [5, 5, 0, 5, 5, 5, 10, 1, 6, 11, 2, 12, 7, 7, 7, 3, 4, 8, 9, 13, 14, 17 ,16, 15], [0, 10, 1, 1, 6, 11, 11, 2, 7, 12, 7, 7, 3, 8, 13, 4, 9, 9, 14, 14, 17, 16, 15, 5], 'straight');
  all.registFlow(paramSet);
  let h1 = new rotaryHub();
  let h2 = new assembleRotaryHub(5);  // あ、そうか、limitで初期化するんだっけ。
  all.flows = all.flows.concat([h1, h2]);
  all.baseFlows = all.baseFlows.concat([h1, h2]);
  // ちょっとばかし線を追加しますか
  paramSet = getOrbitalFlow(vecs, [0, 10, 1, 11], [6, 6, 6, 6], 'straight');
  all.registFlow(paramSet);
  all.connectMulti(arSeq(0, 1, 30), [[2, 26], [6, 27], [7, 28], [7, 28], [8], [9, 29], [9, 29], [10], [25], [11], [25], [25], [15], [17], [19], [16], [18], [18], [20], [20], [21], [22], [23], [24], [0, 3, 4, 5, 1], [12, 13, 14], [8], [8], [8], [8]]);
  all.registActor([22, 22, 22, 22, 22], [1.6, 1.8, 2.0, 2.2, 2.4], [0, 1, 2, 3, 4]);
  all.activateAll();
  // すばらしい。かんぺき。rotaryは順繰りに行先を変えてくれるので同じハブからいろんなflowにつなげる。
  // assembleRotaryは集まるごとに行先が変わるのでMassGameなどに使える。
}
// まあ、bulletってクラス作ってfromとtoとdiffVector持たせればいいんだけどね・・
function createPattern9(){
  // rect, ellipseのテスト
  // とりあえず横移動。
  let vecs = getVector([100, 200], [100, 100]);
  let paramSet = getOrbitalFlow(vecs, [0], [1], 'straight');
  all.registFlow(paramSet);
  // fanはこっちに書く（DIFFなので）
  vecs = getVector([300, -100], [100, 300]);
  paramSet = getOrientedMuzzle(vecs, [1], [0], [0.1], [60], [DIFF], [[0, 1]], [3]);
  all.registFlow(paramSet);
  // まずはrect.
  vecs = getVector([100, 500], [100, 500]);
  paramSet = getOrientedMuzzle(vecs, [1], [0], [0.1], [60], [DIRECT], [[0, 1]], [1]);
  all.registFlow(paramSet);
  // 次にellipse.
  vecs = getVector([300, 200], [300, 200]);
  paramSet = getOrientedMuzzle(vecs, [1], [0], [0.1], [60], [DIRECT], [[0, 1]], [2]);
  all.registFlow(paramSet);
  // 戻す用
  let v = createVector(100, 100);
  paramSet = getOrientedMuzzle([v], [1], [0], [0.1], [60], [DIRECT], [[0]], [0]);
  all.registFlow(paramSet);
  // もう一度おねがい
  vecs = getVector([100, 200], [100, 100]);
  paramSet = getOrbitalFlow(vecs, [0], [1], 'straight');
  all.registFlow(paramSet);
  // 戻した後でrotationいってみようか
  vecs = [createVector(200, 0), createVector(1, 0.1), createVector(200, 0)];
  paramSet = getOrientedMuzzle(vecs, [1], [0], [0.1], [60], [DIFF], [[0, 1, 2]], [4]);
  all.registFlow(paramSet);
  // 良い感じ
  // じゃあ最後にパラレル
  // 戻す用
  v = createVector(100, 100);
  paramSet = getOrientedMuzzle([v], [1], [0], [0.1], [60], [DIRECT], [[0]], [0]);
  all.registFlow(paramSet);
  // もう一度おねがい
  vecs = getVector([100, 200], [100, 100]);
  paramSet = getOrbitalFlow(vecs, [0], [1], 'straight');
  all.registFlow(paramSet);
  // parallel.
  vecs = [createVector(200, 0), createVector(-10, 10), createVector(200, 0)];
  paramSet = getOrientedMuzzle(vecs, [1], [0], [0.1], [60], [DIFF], [[0, 1, 2]], [5]);
  all.registFlow(paramSet);
  // 戻す用
  v = createVector(100, 100);
  paramSet = getOrientedMuzzle([v], [1], [0], [0.1], [60], [DIRECT], [[0]], [0]);
  all.registFlow(paramSet);

  all.connectMulti([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10], [[1], [2], [3], [4], [5], [6], [7], [8], [9], [10], [0]]);

  all.registActor(constSeq(0, 36), constSeq(2, 36), constSeq(0, 36));
  all.activateAll();
}

// 速度を与えて毎フレームその分だけ移動するとか？その場合イージングはどうなる・・

// --------------------------------------------------------------------------------------- //
// utility.
function typeSeq(typename, n){
  // typenameの辞書がn個。
  let array = [];
  for(let i = 0; i < n; i++){ array.push({type: typename}); }
  return array;
}

function constSeq(c, n){
  // cがn個。
  let array = [];
  for(let i = 0; i < n; i++){ array.push(c); }
  return array;
}

function jointSeq(arrayOfArray){
  // 全部繋げる
  let array = arrayOfArray[0];
  //console.log(array);
  for(let i = 1; i < arrayOfArray.length; i++){
    array = array.concat(arrayOfArray[i]);
  }
  return array;
}

function multiSeq(a, m){
  // arrayがm個
  let array = [];
  for(let i = 0; i < m; i++){ array = array.concat(a); }
  return array;
}

function arSeq(start, interval, n){
  // startからintervalずつn個
  let array = [];
  for(let i = 0; i < n; i++){ array.push(start + interval * i); }
  return array;
}

function arCosSeq(start, interval, n, radius = 1, pivot = 0){
  // startからintervalずつn個をradius * cos([]) の[]に放り込む。pivotは定数ずらし。
  let array = [];
  for(let i = 0; i < n; i++){ array.push(pivot + radius * cos(start + interval * i)); }
  return array;
}

function arSinSeq(start, interval, n, radius = 1, pivot = 0){
  // startからintervalずつn個をradius * sin([]) の[]に放り込む。pivotは定数ずらし。
  let array = [];
  for(let i = 0; i < n; i++){ array.push(pivot + radius * sin(start + interval * i)); }
  return array;
}

function randomInt(n){
  // 0, 1, ..., n-1のどれかを返す
  return Math.floor(random(n));
}

function getVector(posX, posY){
  let vecs = [];
  for(let i = 0; i < posX.length; i++){
    vecs.push(createVector(posX[i], posY[i]));
  }
  return vecs;
}

// OrbitalFlow用の辞書作るよー
function getOrbitalFlow(vecs, fromIds, toIds, typename, allOne = true){
  let paramSet = [];
  for(let i = 0; i < fromIds.length; i++){
    let dict = {type: typename, from: vecs[fromIds[i]], to: vecs[toIds[i]]};
    if(allOne){ dict['factor'] = 1; } // factorをすべて1にするオプション
    paramSet.push(dict);
  }
  return paramSet;
}

function getOrbitalEasingFlow(vecs, idSet1, idSet2, ratioSet, spanSet, firstVectorIds, secondVectorIds){
  // orbitalEasingFlow用(spanに-1入れるのはやめた・・)
  let paramSet = [];
  for(let i = 0; i < idSet1.length; i++){
    let dict = {type:'orbitalEasing', easeId1:idSet1[i], easeId2:idSet2[i], ratio:ratioSet[i], spanTime:spanSet[i]};
    dict['from'] = vecs[firstVectorIds[i]];
    dict['to'] = vecs[secondVectorIds[i]];
    paramSet.push(dict);
  }
  return paramSet;
}

function getOrientedMuzzle(vecs, idSet1, idSet2, ratioSet, spanSet, kinds, arrayOfInfoIdArray, modes){
  // orientedFlow用(muzzle用)
  let paramSet = [];
  for(let i = 0; i < idSet1.length; i++){
    let dict = {type:'orientedMuzzle', easeId1:idSet1[i], easeId2:idSet2[i], ratio:ratioSet[i], spanTime:spanSet[i], kind:kinds[i], mode:modes[i]};
    // ベクトルの集合に置き換える
    let infoVectorArray = [];
    arrayOfInfoIdArray[i].forEach(function(id){ infoVectorArray.push(vecs[id]); })
    dict['infoVectorArray'] = infoVectorArray;
    paramSet.push(dict);
  }
  return paramSet;
}

// イージングに引数取るようにしたら面白そう
function funcP0(x){ return x; } // 通常。
function funcP1(x){ return 3 * pow(x, 2) - 2 * pow(x, 3); } // 2乗で入って3乗で出る
function funcP2(x){ return 3 * pow(x, 4) - 2 * pow(x, 6); } // 4乗で入って6乗で出る
function funcP3(x){ return x * (2 * x - 1); } // バックイン
function funcP4(x){ return 1 + (1 - x) * (2 * x - 1); } // バックアウト
function funcP5(x){ return -12 * pow(x, 3) + 18 * pow(x, 2) - 5 * x; } // バックインアウト
function funcP6(x){ return (x / 8) + (7 / 8) * pow(x, 4); } // ゆっくり からの ぎゅーーーん
function funcP7(x){ return (7 / 8) + (x / 8) - (7 / 8) * pow(1 - x, 4); } // ぎゅーーーん からの ゆっくり
function funcP8(x){ return 0.5 * (1 - cos(9 * PI * x)); } // 波打つやつ

function funcN0(x){ return 0; }
function funcN1(x){ return sin(10 * PI * x); }
