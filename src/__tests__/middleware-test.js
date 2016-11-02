/**
 * Created by andrew on 10/30/16.
 */
import { expect } from 'chai';
import configureMockStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import { createAction } from 'redux-actions';

import middlewareToTest, { dispatchActionWhen } from '../index';

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

    [
      S => action,
      S => [ action ],
      S => S.SINGLE(action),
      S => S.QUEUE([ S.SINGLE(action) ])

    ].forEach((sequenceDescription, idx) => {

      it('Definition #' + (idx + 1), () => {

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

    [
      () => 'action',
      () => ({ type: 'action' }),
      () => createAction('action')

    ].forEach((actionDefinition, idx) => {
      it('Definition #' + (idx + 1), () => {

        const reaction = {type: 'sequence_met'};
        const sequence = dispatchActionWhen(reaction, S => actionDefinition());
        let actions;

        const store = mockStore({});
        store.dispatch(action); // 1

        actions = store.getActions();
        expect(actions).to.deep.equal([
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

});