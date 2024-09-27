// import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'

// export const apiSlice = createApi({
//     reducerPath: 'api',
//     baseQuery: fetchBaseQuery({ baseUrl: 'http://localhost:3500' }),
//     tagTypes: ['Todos'],
//     endpoints: (builder) => ({
//         getTodos: builder.query({
//             query: () => '/todos',
//             transformResponse: res => res.reverse((a, b) => b.id - a.id),
//             providesTags: ['Todos']
//         }),
//         addTodo: builder.mutation({
//             query: (todo) => ({
//                 url: '/todos',
//                 method: 'POST',
//                 body: todo
//             }),
//             invalidatesTags: ['Todos']
//         }),
//         updateTodo: builder.mutation({
//             query: (todo) => ({
//                 url: `/todos/${todo.id}`,
//                 method: 'PATCH',
//                 body: todo
//             }),
//             invalidatesTags: ['Todos']
//         }),
//         deleteTodo: builder.mutation({
//             query: ({ id }) => ({
//                 url: `/todos/${id}`,
//                 method: 'DELETE',
//                 body: id
//             }),
//             invalidatesTags: ['Todos']
//         }),
//     })
// })

// export const {
//     useGetTodosQuery,
//     useAddTodoMutation,
//     useUpdateTodoMutation,
//     useDeleteTodoMutation
// } = apiSlice

//* Solution to avoid tri problem & to make delete for new items works:

import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'

export const apiSlice = createApi({
    reducerPath: 'api',
    baseQuery: fetchBaseQuery({ baseUrl: 'http://localhost:3500' }),
    tagTypes: ['Todos'],
    endpoints: (builder) => ({
        getTodos: builder.query({
            query: () => '/todos',
            transformResponse: res => {
                // Sort by id, ensuring 'optimistic' todos stay at the top
                return res.reverse((a, b) => b.id - a.id);
            },
            providesTags: ['Todos']
        }),
        addTodo: builder.mutation({
            query: (todo) => ({
                url: '/todos',
                method: 'POST',
                body: todo
            }),
            async onQueryStarted(todo, { dispatch, queryFulfilled }) {
                // Optimistically update the cache
                const patchResult = dispatch(
                    apiSlice.util.updateQueryData('getTodos', undefined, draft => {
                        // Insert the new todo with a temporary id and 'optimistic' flag at the top
                        draft.unshift({ ...todo, id: Date.now(), optimistic: true });
                    })
                );
                
                try {
                    // Wait for the server response and replace the optimistic todo
                    const { data: newTodo } = await queryFulfilled;
                    dispatch(
                        apiSlice.util.updateQueryData('getTodos', undefined, draft => {
                            // Find the temporary optimistic todo and replace it with the real server response
                            const index = draft.findIndex(item => item.optimistic && item.id === todo.id);
                            if (index !== -1) {
                                draft[index] = newTodo;  // Replace the optimistic todo with the server response
                            } else {
                                draft.unshift(newTodo);  // Add to the top if optimistic todo not found
                            }
                            // Sort the list, but keep the new item at the top until sorted by server id
                            // you should replace sort by reverse
                            draft.reverse((a, b) => b.id - a.id);
                        })
                    );
                } catch (error) {
                    patchResult.undo();  // If mutation fails, undo optimistic update
                }
            },
            invalidatesTags: ['Todos']
        }),
        updateTodo: builder.mutation({
            query: (todo) => ({
                url: `/todos/${todo.id}`,
                method: 'PATCH',
                body: todo
            }),
            invalidatesTags: ['Todos']
        }),
        deleteTodo: builder.mutation({
            query: ({ id }) => ({
                url: `/todos/${id}`,
                method: 'DELETE'
            }),
            async onQueryStarted({ id }, { dispatch, queryFulfilled }) {
                // Optimistically remove the item from the cache
                const patchResult = dispatch(
                    apiSlice.util.updateQueryData('getTodos', undefined, draft => {
                        // Filter out the todo with the given id
                        return draft.filter(todo => todo.id !== id);
                    })
                );
                
                try {
                    await queryFulfilled; // Wait for the server response
                } catch (error) {
                    patchResult.undo(); // If deletion fails, undo optimistic removal
                }
            },
            invalidatesTags: ['Todos']
        }),
    })
});

export const {
    useGetTodosQuery,
    useAddTodoMutation,
    useUpdateTodoMutation,
    useDeleteTodoMutation
} = apiSlice;

