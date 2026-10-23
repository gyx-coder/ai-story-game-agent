import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { assertOutline, assertReview, assertScene, gameFromOutline, validateGame } from './contracts.js'
import { replayBrief, replayCharacters, replayOutline, replayScenes, replayWorld, replayReport, defectQuote } from './replay.js'
import { availableChoices, choose, currentScene, startGame } from '../../shared/engine.js'

test('Replay 的分支和三个结局均实际可达', () => {
  assertOutline(replayBrief, replayOutline, replayCharacters)
  const game = gameFromOutline(replayBrief, replayOutline, replayCharacters, replayScenes(false))
  const paths = validateGame(game)
  assert.equal(Object.keys(paths).length, 3)
  assert.ok(Object.values(paths).every((path) => path.length > 0))
})

test('前面的选择改变控制室可用选项', () => {
  const game = gameFromOutline(replayBrief, replayOutline, replayCharacters, replayScenes(false))
  const start = startGame(game)
  const withKey = choose(game, choose(game, start, 'repair'), 'control')
  const withoutKey = choose(game, choose(game, start, 'medical'), 'control')
  assert.ok(availableChoices(currentScene(game, withKey), withKey.flags).some((item) => item.id === 'restart'))
  assert.ok(!availableChoices(currentScene(game, withoutKey), withoutKey.flags).some((item) => item.id === 'restart'))
})

test('无效目标、未知状态和不可达结局不能发布', () => {
  const base = gameFromOutline(replayBrief, replayOutline, replayCharacters, replayScenes(false))
  assert.throws(() => validateGame({ ...base, scenes: base.scenes.map((scene) => scene.id === 'scene-01' ? { ...scene, choices: [{ ...scene.choices[0], to: 'missing' }, scene.choices[1]] } : scene) }), /不存在/)
  assert.throws(() => validateGame({ ...base, scenes: base.scenes.map((scene) => scene.id === 'scene-04' ? { ...scene, choices: scene.choices.map((choice) => ({ ...choice, when: { unavailable: true } })) } : scene) }), /未知状态/)
  assert.throws(() => validateGame({ ...base, scenes: base.scenes.filter((scene) => scene.id !== 'ending-03') }), /不存在/)
})

test('场景的分支结构始终以已批准大纲为准', () => {
  const value = replayScenes(false)[0]
  const reordered = assertScene(replayOutline, { ...value, choices: value.choices.map(({ id, text, to, when, effects }) => ({ id, to, text, effects, when })) }, value.id)
  assert.deepEqual(reordered.choices, value.choices)

  // 模型写歪了分支也照收，只是把结构覆盖回大纲
  const drifted = assertScene(replayOutline, { ...value, ending: !value.ending, choices: [{ ...value.choices[0], to: 'ending-01' }] }, value.id)
  assert.deepEqual(drifted.choices, value.choices)
  assert.equal(drifted.ending, value.ending)
})

test('引用不到原文的审核问题会被丢弃', () => {
  const defect = replayScenes(true)
  assert.ok(defect.find((scene) => scene.id === 'ending-02')?.content.includes(defectQuote))
  assert.equal(assertReview(replayReport(true), defect).issues.length, 1)

  // 引用对不上原文：丢掉这条问题，结论按通过处理
  const cleaned = assertReview({ verdict: 'needs_revision', issues: [{ ...replayReport(true).issues[0], quote: '不存在的原文' }] }, defect)
  assert.equal(cleaned.issues.length, 0)
  assert.equal(cleaned.verdict, 'approved')
})
