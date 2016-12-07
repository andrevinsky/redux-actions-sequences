/**
 * Created by andrew on 10/30/16.
 */
import { expect } from 'chai';
import configureMockStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import { createAction } from 'redux-actions';

import middlewareToTest, { dispatchActionWhen, clearAll } from '../index';

const middlewares = [ thunk, middlewareToTest ];
const mockStore = configureMockStore(middlewares);

describe('redux-actions-sequences:', () => {


  it('Dispatches no additional actions if no sequences defined', () => {

    const action = { type: 'action' };

    const store = mockStore({});
    store.dispatch(action);

    const actions = store.getActions();

    expect(actions).to.deep.equal([{ type: 'action' }]);

  });

  describe('A sequence can be unregistered several ways', () => {
    const action = { type: 'action' };
    const reaction = { type: 'sequence_met' };

    it('A sequence can get unsubscribed with a handler returned from `dispatch()` call', () => {
      const sequence = dispatchActionWhen(reaction, ({ simple }) => simple(action));
      const store = mockStore({});

      let actions;

      // definition of sequence does not start it
      store.dispatch(action);

      actions = store.getActions();
      expect(actions).to.deep.equal([
        action
      ]);

      store.clearActions();

      // dispatch starts the sequence
      const unregister = store.dispatch(sequence);

      store.dispatch(action);

      actions = store.getActions();
      expect(actions).to.deep.equal([
        action,
        reaction
      ]);

      store.clearActions();

      // Unregister cancels the sequence listening
      unregister();

      store.dispatch(action);

      actions = store.getActions();
      expect(actions).to.deep.equal([
        action
      ]);

    });

    it('..or if the sequence action is a string, the action.meta.unregister()', () => {
      const sequence = dispatchActionWhen(reaction.type, ({ simple }) => simple(action));
      const store = mockStore({});

      let actions;

      // definition of sequence does not start it
      store.dispatch(action);

      actions = store.getActions();
      expect(actions).to.deep.equal([
        action
      ]);

      store.clearActions();

      store.dispatch(sequence);

      store.dispatch(action);

      actions = store.getActions();
      expect(actions[1].type).to.equal(reaction.type);
      expect(actions[1].meta).to.be.defined;
      expect(actions[1].meta.unregister).to.be.defined;

      store.clearActions();

      const unregister = actions[1].meta.unregister;

      // Unregister cancels the sequence listening
      unregister();

      store.dispatch(action);

      actions = store.getActions();
      expect(actions).to.deep.equal([
        action
      ]);

    });

    it('..or if the sequence action is an function, the unregister() function will be passed as a first parameter', () => {
      const thunked = (unregister) => dispatch => {
        dispatch(reaction);
        unregister();
      };
      const sequence = dispatchActionWhen(thunked, ({ simple }) => simple(action));
      const store = mockStore({});

      let actions;

      // definition of sequence does not start it
      store.dispatch(action);

      actions = store.getActions();
      expect(actions).to.deep.equal([
        action
      ]);

      store.clearActions();

      store.dispatch(sequence);

      store.dispatch(action);

      actions = store.getActions();
      expect(actions).to.deep.equal([
        action,
        reaction
      ]);

      store.clearActions();

      // Unregister has been called inside thunked.

      store.dispatch(action);

      actions = store.getActions();
      expect(actions).to.deep.equal([
        action
      ]);

    });


  });

  describe('Dispatches a reaction action if a sequence is defined and met. ', () => {

    const action = { type: 'action' };
    const reaction = { type: 'sequence_met' };

   const resources = [
      'Ad-hoc, string for action type',
      'Ad-hoc, plain object',
      'Ad-hoc, FSA-action creator',
      'Result of built-in <SIMPLE> sequence builder',
      'Array of ad-hoc, plain objects',
      'Result of two nested operations: built-in <QUEUE> and <SIMPLE> sequence builders',
      'Result of two nested operations: built-in <QUEUE> and <SIMPLE> sequence builders, in reversed order'
    ];

    [
      () => action.type,
      () => action,
      () => createAction(action.type),
      ({ simple }) => simple(action),
      () => [ action ],
      ({ simple, queue }) => queue([ simple(action) ]),
      ({ simple, queue }) => simple(queue([ action ]))

    ].forEach((sequenceDescription, idx) => {

      it('Definition: ' + resources[idx], () => {

        const sequence = dispatchActionWhen(reaction, sequenceDescription);
        let actions;

        const store = mockStore({});
        store.dispatch(action); // 1

        actions = store.getActions();
        expect(actions).to.deep.equal([
          action
        ]);

        store.clearActions();

        const unregister = store.dispatch(sequence); // 2

        actions = store.getActions();
        expect(actions).to.deep.equal([]);

        store.dispatch(action); // 3

        actions = store.getActions();
        expect(actions).to.deep.equal([
          action,
          reaction
        ]);

        unregister();

      });
    });

  });

  describe('Sequence can be build based on these action definitions. ', () => {

    const action = { type: 'action' };

    const resources = [
      'A string with the expected action type',
      'A FSA-compliant plain object',
      'A `redux-actions`-created action creator, which can be `toString()`-ed to type'
    ];

    [
      () => 'action',
      () => ({ type: 'action' }),
      () => createAction('action')

    ].forEach((actionDefinition, idx) => {
      it('Definition: ' + resources[idx], () => {

        const reaction = { type: 'sequence_met' };
        const sequence = dispatchActionWhen(reaction, S => actionDefinition());
        let actions;

        const store = mockStore({});
        store.dispatch(action); // 1

        expect(store.getActions()).to.deep.equal([
          { type: 'action' }
        ]);

        store.clearActions();

        const unregister = store.dispatch(sequence); // 2

        actions = store.getActions();
        expect(actions).to.deep.equal([]);

        store.dispatch(action); // 3

        actions = store.getActions();
        expect(actions).to.deep.equal([
          { type: 'action' },
          { type: 'sequence_met' }
        ]);

        unregister();

      });

    });

  });

  describe('Repetitions', () => {
    const action = { type: 'action' };
    const reaction = { type: 'sequence_met' };

    [
      {
        description: 'Repeated',
        sequence: dispatchActionWhen(reaction, ({ simple }) => simple(action)),
        steps: [
          {
            fire: action,
            expecting: [ action, reaction ]
          },
          {
            fire: action,
            expecting: [ action, reaction, action, reaction ]
          }
        ]
      },
      {
        description: 'Once',
        sequence: dispatchActionWhen(reaction, ({ once }) => once(action)),
        steps: [
          {
            fire: action,
            expecting: [ action, reaction ]
          },
          {
            fire: action,
            expecting: [ action, reaction, action ]
          }
        ]
      }
    ].forEach(({ description, sequence, steps }) => {
      it('Sequence: ' + description, () => {

        clearAll();

        const store = mockStore({});
        const actions = () => store.getActions();

        store.dispatch(action); // 1
        expect(actions()).to.deep.equal([
          { type: 'action' }
        ]);

        store.clearActions();

        const unregister = store.dispatch(sequence); // 2
        expect(actions()).to.deep.equal([]);

        steps.forEach(({ fire, expecting }) => {
          store.dispatch(fire); // 3
          expect(actions()).to.deep.equal(expecting);
        });

        unregister();

      })
    });
  });

  describe('API', () => {
    const action = { type: 'action' };
    const action_1 = { type: 'action_1' };
    const action_2 = { type: 'action_2' };
    const noise_action = { type: 'noise_action' };
    const exact_action_ok = {
      type: 'action',
      payload: {
        items: [],
        offset: 0
      }
    };
    const exact_actions_bad = [
      {
        ...exact_action_ok,
        type: 'actions'
      },
      {
        ...exact_action_ok,
        meta: {}
      }, {
        ...exact_action_ok,
        payload: {
          offset: 0
        }
      }, {
        ...exact_action_ok,
        payload: {
          ...exact_action_ok.payload,
          offset: 10
        }
      }, {
        ...exact_action_ok,
        error: true
      }
    ];
    const reaction = { type: 'sequence_met' };

    [
      {
        description: 'Simple',
        sequence: dispatchActionWhen(reaction, ({ simple }) => simple(action)),
        steps: [
          {
            fire: action,
            expecting: [ action, reaction ]
          },
          {
            fire: action,
            expecting: [ action, reaction, action, reaction ]
          }
        ]
      },
      {
        description: 'Exact',
        sequence: dispatchActionWhen(reaction,
          ({ exact, present, missing, truthy, falsey }) => exact({
            type: action.type,
            meta: missing,
            payload: {
              items: present,
              offset: 0
            },
            error: falsey
          })),
        steps: [
          {
            fire: exact_action_ok,
            expecting: [ exact_action_ok, reaction ]
          },
          {
            fire: exact_action_ok,
            expecting: [ exact_action_ok, reaction, exact_action_ok, reaction ]
          }
        ].concat(exact_actions_bad.reduce((memo, fire) => {
          const lastItem = memo[memo.length - 1] || {};
          const current = {
            fire,
            expecting: (lastItem.expecting || [ exact_action_ok, reaction, exact_action_ok, reaction ]).concat([ fire ])
          };
          return [...memo, current];
        }, []))
      },
      {
        description: 'Once',
        sequence: dispatchActionWhen(reaction, ({ once }) => once(action)),
        steps: [
          {
            fire: action,
            expecting: [ action, reaction ]
          },
          {
            fire: action,
            expecting: [ action, reaction, action ]
          }
        ]
      },
      {
        description: 'Times',
        sequence: dispatchActionWhen(reaction, ({ times }) => times(action, 2)),
        steps: [
          {
            fire: action,
            expecting: [ action ]
          },
          {
            fire: noise_action,
            expecting: [ action, noise_action ]
          },
          {
            fire: action,
            expecting: [ action, noise_action, action, reaction ]
          },
          {
            fire: action,
            expecting: [ action, noise_action, action, reaction, action ]
          },
          {
            fire: action,
            expecting: [ action, noise_action, action, reaction, action, action, reaction ]
          }
        ]
      },
      {
        description: 'Times Strict',
        sequence: dispatchActionWhen(reaction, ({ timesStrict }) => timesStrict(action, 2)),
        steps: [
          {
            fire: action,
            expecting: [ action ]
          },
          {
            fire: noise_action,
            expecting: [ action, noise_action ]
          },
          {
            fire: action,
            expecting: [ action, noise_action, action ]
          },
          {
            fire: action,
            expecting: [ action, noise_action, action, action, reaction ]
          }
        ]
      },
      {
        description: 'All',
        sequence: dispatchActionWhen(reaction, ({ all }) => all([action_1, action_2])),
        steps: [
          {
            fire: action_1,
            expecting: [
              action_1
            ]
          },
          {
            fire: noise_action,
            expecting: [
              action_1,
              noise_action
            ]
          },
          {
            fire: action_2,
            expecting: [
              action_1,
              noise_action,
              action_2,
              reaction // <----!!
            ]
          },
          {
            fire: action_2,
            expecting: [
              action_1,
              noise_action,
              action_2,
              reaction, // <----!!
              action_2
            ]
          },
          {
            fire: noise_action,
            expecting: [
              action_1,
              noise_action,
              action_2,
              reaction, // <----!!
              action_2,
              noise_action
            ]
          },
          {
            fire: action_1,
            expecting: [
              action_1,
              noise_action,
              action_2,
              reaction, // <----!!
              action_2,
              noise_action,
              action_1,
              reaction // <----!!
            ]
          }
        ]
      },
      {
        description: 'Any',
        sequence: dispatchActionWhen(reaction, ({ any }) => any([action_1, action_2])),
        steps: [
          {
            fire: action_1,
            expecting: [
              action_1,
              reaction // <----!!
            ]
          },
          {
            fire: noise_action,
            expecting: [
              action_1,
              reaction, // <----!!
              noise_action
            ]
          },
          {
            fire: action_2,
            expecting: [
              action_1,
              reaction, // <----!!
              noise_action,
              action_2,
              reaction // <----!!
            ]
          }
        ]
      },
      {
        description: 'Queue',
        sequence: dispatchActionWhen(reaction, ({ queue }) => queue([action_1, action_2])),
        steps: [
          {
            fire: action_2,
            expecting: [
              action_2
            ]
          },
          {
            fire: action_1,
            expecting: [
              action_2,
              action_1
            ]
          },
          {
            fire: noise_action,
            expecting: [
              action_2,
              action_1,
              noise_action
            ]
          },
          {
            fire: action_2,
            expecting: [
              action_2,
              action_1,
              noise_action,
              action_2,
              reaction // <----!!
            ]
          }
        ]
      },
      {
        description: 'Queue Strict',
        sequence: dispatchActionWhen(reaction, ({ queueStrict }) => queueStrict([action_1, action_2])),
        steps: [
          {
            fire: action_2,
            expecting: [
              action_2
            ]
          },
          {
            fire: action_1,
            expecting: [
              action_2,
              action_1
            ]
          },
          {
            fire: noise_action, // noise disrupts queue, if strict
            expecting: [
              action_2,
              action_1,
              noise_action
            ]
          },
          {
            fire: action_2,
            expecting: [
              action_2,
              action_1,
              noise_action,
              action_2
            ]
          },
          {
            fire: action_1,
            expecting: [
              action_2,
              action_1,
              noise_action,
              action_2,
              action_1
            ]
          },
          {
            fire: action_2,
            expecting: [
              action_2,
              action_1,
              noise_action,
              action_2,
              action_1,
              action_2,
              reaction
            ]
          }
        ]
      }
    ].forEach(({ description, sequence, steps }) => {
      it('Sequence: ' + description, () => {

        const store = mockStore({});
        const actions = () => store.getActions();

        store.dispatch(action); // 1
        expect(actions()).to.deep.equal([
          { type: 'action' }
        ]);

        store.clearActions();

        const unregister = store.dispatch(sequence); // 2
        expect(actions()).to.deep.equal([]);

        steps.forEach(({ fire, expecting }) => {
          store.dispatch(fire); // 3
          expect(actions()).to.deep.equal(expecting);
        });

        unregister();

      })
    });
  });

});