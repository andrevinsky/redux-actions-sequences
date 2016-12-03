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

  describe('Dispatches a defined action if a sequence is defined and met. ', () => {

    const action = { type: 'action' };

    const resources = [
      'Ad-hoc, plain object',
      'Result of built-in <SINGLE> sequence builder',
      'Array of ad-hoc, plain objects',
      'Result of two nested operations: built-in <QUERY> and <SINGLE> sequence builders'
    ];

    [
      S => action,
      S => S.SINGLE(action),
      S => [ action ],
      S => S.QUEUE([ S.SINGLE(action) ])

    ].forEach((sequenceDescription, idx) => {

      it('Definition: ' + resources[idx], () => {

        const reaction = { type: 'sequence_met' };
        const sequence = dispatchActionWhen(reaction, sequenceDescription);
        let actions;

        const store = mockStore({});
        store.dispatch(action); // 1

        actions = store.getActions();
        expect(actions).to.deep.equal([
          { type: 'action' }
        ]);

        store.clearActions();

        store.dispatch(sequence); // 2

        actions = store.getActions();
        expect(actions).to.deep.equal([
        ]);

        store.dispatch(action); // 3

        actions = store.getActions();
        expect(actions).to.deep.equal([
          { type: 'action' },
          { type: 'sequence_met' }
        ]);

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

        const reaction = {type: 'sequence_met'};
        const sequence = dispatchActionWhen(reaction, S => actionDefinition());
        let actions;

        const store = mockStore({});
        store.dispatch(action); // 1

        expect(store.getActions()).to.deep.equal([
          {type: 'action'}
        ]);

        store.clearActions();

        store.dispatch(sequence); // 2

        actions = store.getActions();
        expect(actions).to.deep.equal([]);

        store.dispatch(action); // 3

        actions = store.getActions();
        expect(actions).to.deep.equal([
          {type: 'action'},
          {type: 'sequence_met'}
        ]);


      });

    });

  });

  describe('Repetitions', () => {
    const action = { type: 'action' };
    const reaction = { type: 'sequence_met' };

    [
      {
        description: 'Repeated',
        sequence: dispatchActionWhen(reaction, S =>
          S.SINGLE(action)
        ),
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
        sequence: dispatchActionWhen(reaction, (S =>
          S.SINGLE(action)),
          { once: true }
        ),
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

        const store = mockStore({});
        const actions = () => store.getActions();

        store.dispatch(action); // 1
        expect(actions()).to.deep.equal([
          { type: 'action' }
        ]);

        store.clearActions();

        store.dispatch(sequence); // 2
        expect(actions()).to.deep.equal([]);

        steps.forEach(({ fire, expecting }) => {
          store.dispatch(fire); // 3
          expect(actions()).to.deep.equal(expecting);
        });

      })
    });
  });

});